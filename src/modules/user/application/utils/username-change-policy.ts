/** Cooldown ganti ke username baru (mobile#257). */
export const USERNAME_CHANGE_COOLDOWN_DAYS = 7;

/** Hold username lama agar pemilik bisa reclaim (pola Instagram). */
export const USERNAME_HOLD_DAYS = 14;

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Null = boleh ganti sekarang. */
export function computeUsernameChangeAllowedAt(
  usernameChangedAt: Date | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (!usernameChangedAt) return null;
  const allowed = addDays(usernameChangedAt, USERNAME_CHANGE_COOLDOWN_DAYS);
  return allowed.getTime() > now.getTime() ? allowed : null;
}
