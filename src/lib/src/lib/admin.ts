/** Exact Clerk IDs only. Empty configuration grants nobody access. */
export function isAdminUser(userId: string | null | undefined, allowlist = process.env.ADMIN_USER_IDS ?? '') {
  return !!userId && allowlist.split(',').map(id => id.trim()).filter(Boolean).includes(userId);
}
export function adminPage(value: string | null) {
  const n = Number(value ?? 1);
  return Number.isSafeInteger(n) && n > 0 && n <= 100000 ? n : 1;
}
