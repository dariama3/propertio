-- Propertio: акаунти, спільні списки (workspaces), підписка Pro.

-- ───────────── Таблиці ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_pro boolean not null default false,
  subscription_id text,
  subscription_status text not null default 'free'
    check (subscription_status in ('free','active','past_due','cancelled')),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique
    default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  flats jsonb not null default '[]'::jsonb,
  hidden_ids jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid                     -- хто змінив останнім (щоб клієнт відсікав «ехо» Realtime)
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

-- ───────────── Допоміжні функції (SECURITY DEFINER, щоб RLS не зациклювався) ─────────────
create function public.is_member(p_ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members where workspace_id = p_ws and user_id = auth.uid());
$$;

create function public.can_edit(p_ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members
    where workspace_id = p_ws and user_id = auth.uid() and role in ('owner','editor'));
$$;

create function public.is_ws_owner(p_ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspaces where id = p_ws and owner_id = auth.uid());
$$;

create function public.shares_workspace(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members a join workspace_members b using (workspace_id)
    where a.user_id = auth.uid() and b.user_id = p_user);
$$;

-- Pro-статус власника списку (усі учасники користуються Pro в межах цього списку)
create function public.ws_owner_is_pro(p_ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_pro from workspaces w join profiles p on p.id = w.owner_id
    where w.id = p_ws), false);
$$;

-- ───────────── Тригери ─────────────
-- Новий користувач → профіль + список «Мій список» + роль owner
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  insert into profiles (id, email) values (new.id, coalesce(new.email, ''));
  insert into workspaces (name, owner_id) values ('Мій список', new.id) returning id into ws;
  insert into workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ліміт квартир для Free (єдине місце, де його змінювати)
create function public.free_flat_limit() returns int
language sql immutable as $$ select 10 $$;

-- Мітка змін + ліміт Free на будь-який шлях запису
create function public.workspaces_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if jsonb_array_length(new.flats) > public.free_flat_limit()
     and jsonb_array_length(new.flats) > jsonb_array_length(old.flats)
     and not coalesce((select is_pro from profiles where id = new.owner_id), false) then
    raise exception 'err.limit_flats' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger workspaces_before_update before update on public.workspaces
  for each row execute function public.workspaces_before_update();

create function public.profiles_touch() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.profiles_touch();

-- ───────────── RLS ─────────────
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- profiles: читати себе та співучасників; змінювати можна лише service_role (вебхук)
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace(id));

-- workspaces
create policy ws_select on public.workspaces for select to authenticated
  using (public.is_member(id));
create policy ws_update on public.workspaces for update to authenticated
  using (public.can_edit(id)) with check (public.can_edit(id));
-- INSERT/DELETE напряму заборонені: створення — через create_workspace(), видалення — delete_workspace()

-- workspace_members
create policy wm_select on public.workspace_members for select to authenticated
  using (public.is_member(workspace_id));
-- вийти зі списку (не owner) або owner виганяє інших
create policy wm_delete on public.workspace_members for delete to authenticated
  using (role <> 'owner' and (user_id = auth.uid() or public.is_ws_owner(workspace_id)));

-- Клієнт може змінювати лише ці колонки workspaces (не owner_id / invite_code)
revoke update on public.workspaces from authenticated, anon;
grant update (name, flats, hidden_ids, settings) on public.workspaces to authenticated;
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
revoke all on public.workspaces from anon;
revoke all on public.workspace_members from anon;
revoke insert, update on public.workspace_members from authenticated;

-- ───────────── RPC ─────────────
create function public.join_workspace_by_code(p_invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid; own uuid;
begin
  if auth.uid() is null then raise exception 'err.auth_required'; end if;
  select id, owner_id into ws, own from workspaces where invite_code = p_invite_code;
  if ws is null then raise exception 'err.invite_invalid'; end if;
  if not coalesce((select is_pro from profiles where id = own), false) then
    raise exception 'err.pro_required';
  end if;
  insert into workspace_members (workspace_id, user_id, role)
    values (ws, auth.uid(), 'editor') on conflict do nothing;
  return ws;
end $$;

-- Атомарно додає/оновлює квартиру за id (рядок блокується — паралельні правки не затирають одна одну)
create function public.upsert_flat_in_workspace(p_workspace_id uuid, p_flat jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur jsonb; fid text := p_flat->>'id'; res jsonb;
begin
  if not public.can_edit(p_workspace_id) then raise exception 'err.forbidden'; end if;
  if fid is null or fid = '' then raise exception 'err.bad_flat'; end if;
  select flats into cur from workspaces where id = p_workspace_id for update;
  if exists (select 1 from jsonb_array_elements(cur) e where e->>'id' = fid) then
    res := (select jsonb_agg(case when e->>'id' = fid then p_flat else e end order by ord)
            from jsonb_array_elements(cur) with ordinality t(e, ord));
  else
    if jsonb_array_length(cur) >= public.free_flat_limit() and not public.ws_owner_is_pro(p_workspace_id) then
      raise exception 'err.limit_flats';
    end if;
    res := cur || jsonb_build_array(p_flat);
  end if;
  update workspaces set flats = res where id = p_workspace_id;
  return res;
end $$;

create function public.remove_flat_from_workspace(p_workspace_id uuid, p_flat_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.can_edit(p_workspace_id) then raise exception 'err.forbidden'; end if;
  update workspaces set flats = coalesce((
      select jsonb_agg(e order by ord) from jsonb_array_elements(flats) with ordinality t(e, ord)
      where e->>'id' <> p_flat_id), '[]'::jsonb)
    where id = p_workspace_id returning flats into res;
  return res;
end $$;

-- Ховає/показує дефолтну квартиру (атомарно)
create function public.set_hidden_in_workspace(p_workspace_id uuid, p_id text, p_hidden boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.can_edit(p_workspace_id) then raise exception 'err.forbidden'; end if;
  update workspaces set hidden_ids = case
      when p_hidden then (select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
                          from jsonb_array_elements(hidden_ids || to_jsonb(p_id)) x)
      else coalesce((select jsonb_agg(x) from jsonb_array_elements(hidden_ids) x where x <> to_jsonb(p_id)), '[]'::jsonb)
    end
    where id = p_workspace_id returning hidden_ids into res;
  return res;
end $$;

-- Скидає приховані (кнопка «показати всі»)
create function public.clear_hidden_in_workspace(p_workspace_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit(p_workspace_id) then raise exception 'err.forbidden'; end if;
  update workspaces set hidden_ids = '[]'::jsonb where id = p_workspace_id;
end $$;

-- Зливає патч у settings (верхній рівень ключів), а не перезаписує весь об'єкт.
-- Ключ зі значенням null видаляється.
create function public.merge_workspace_settings(p_workspace_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.can_edit(p_workspace_id) then raise exception 'err.forbidden'; end if;
  update workspaces set settings = jsonb_strip_nulls(settings || p_patch)
    where id = p_workspace_id returning settings into res;
  return res;
end $$;

-- Додатковий список: лише для Pro (Free має 1 особистий)
create function public.create_workspace(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if auth.uid() is null then raise exception 'err.auth_required'; end if;
  if not coalesce((select is_pro from profiles where id = auth.uid()), false) then
    raise exception 'err.pro_required';
  end if;
  insert into workspaces (name, owner_id) values (left(coalesce(nullif(trim(p_name), ''), 'Список'), 80), auth.uid())
    returning id into ws;
  insert into workspace_members (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  return ws;
end $$;

create function public.delete_workspace(p_workspace_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_ws_owner(p_workspace_id) then raise exception 'err.forbidden'; end if;
  if (select count(*) from workspaces where owner_id = auth.uid()) <= 1 then
    raise exception 'err.last_workspace';
  end if;
  delete from workspaces where id = p_workspace_id;
end $$;

-- Нове значення invite_code (owner скасовує старе посилання)
create function public.regenerate_invite_code(p_workspace_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_ws_owner(p_workspace_id) then raise exception 'err.forbidden'; end if;
  c := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  update workspaces set invite_code = c where id = p_workspace_id;
  return c;
end $$;

-- Права на виконання: лише для залогінених
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'join_workspace_by_code','upsert_flat_in_workspace','remove_flat_from_workspace',
      'set_hidden_in_workspace','clear_hidden_in_workspace','merge_workspace_settings',
      'create_workspace','delete_workspace','regenerate_invite_code',
      'free_flat_limit','is_member','can_edit','is_ws_owner','shares_workspace','ws_owner_is_pro')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ───────────── Realtime ─────────────
alter publication supabase_realtime add table public.workspaces;
alter publication supabase_realtime add table public.profiles;
