export const ADMIN_EMAILS = new Set(["schr45@gmail.com", "ami@closeapp.co.il"]);

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
