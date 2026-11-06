// Only the authenticated server session can grant unlimited testing.
export function trialQuota(session) {
  const unlimited = session?.unlimited === true;
  const remaining = session ? Math.max(0, Math.min(Number(session.remaining) || 0, Number(session.globalRemaining) || 0)) : 0;
  return {
    unlimited,
    canGenerate: Boolean(session) && (unlimited || remaining > 0),
    label: !session ? '…' : unlimited ? 'ไม่จำกัด' : `${remaining} รอบ`,
    count: !session ? '…' : unlimited ? '∞' : remaining,
  };
}
