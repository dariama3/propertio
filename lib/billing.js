// Статус підписки з Lemon Squeezy → поля profiles
export function mapSubscription(attrs) {
  const st = attrs?.status;
  const endsAt = attrs?.ends_at ? Date.parse(attrs.ends_at) : null;
  if (st === 'active' || st === 'on_trial') return { is_pro: true, subscription_status: 'active' };
  if (st === 'past_due') return { is_pro: true, subscription_status: 'past_due' };   // пільговий період
  if (st === 'cancelled') return { is_pro: !!endsAt && endsAt > Date.now(), subscription_status: 'cancelled' };
  return { is_pro: false, subscription_status: st === 'expired' || st === 'unpaid' ? 'cancelled' : 'free' };
}
