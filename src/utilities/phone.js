export function normalizeUSPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith('1')) {
    // US area codes never start with 1 (NANP rules: [2-9]xx).
    // A 10-digit number starting with 1 indicates an entry
    // where country code +1 was prepended to 9 digits.
    digits = digits.slice(1);
  }
  return digits;
}

export function isValidUSPhone(value) {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(normalizeUSPhone(value));
}

export function formatUSPhone(value) {
  const digits = normalizeUSPhone(value);
  if (!digits) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}
