export function checkAttorneyGuestEntitlement(
  _ownerUserId: string,
  env: Record<string, string | undefined> = process.env
) {
  if (env.ATTORNEY_GUEST_FEATURE_ENABLED === "false") {
    return {
      allowed: false as const,
      reason: "Attorney guest access is not enabled for this account.",
    };
  }
  return { allowed: true as const };
}
