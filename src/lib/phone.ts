export function digitsOnlyPhone(v: string) {
  return String(v ?? "").replace(/[^0-9]/g, "");
}

export function isValidPhone(v: string) {
  const digits = digitsOnlyPhone(v);
  if (!digits) return false;

  if (digits.length < 9 || digits.length > 15) return false;

  if (digits.startsWith("0")) {
    return digits.length === 9 || digits.length === 10;
  }

  if (digits.startsWith("972")) {
    return digits.length === 11 || digits.length === 12;
  }

  return digits.length >= 9 && digits.length <= 15;
}

export function normalizePhoneE164(v: string) {
  const digits = digitsOnlyPhone(v);
  if (!digits) return "";

  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;

  return `+${digits}`;
}
