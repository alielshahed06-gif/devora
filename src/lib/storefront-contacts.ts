export function validPhoneLink(value: string): { label: string; href: string } | null {
  const label = value.trim();
  if (!/^\+?[0-9][0-9\s().-]*$/.test(label)) return null;
  const digits = label.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return { label, href: `tel:${label.replace(/[\s().-]/g, '')}` };
}

export function validEmailAddress(value: string): string | null {
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function validHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
