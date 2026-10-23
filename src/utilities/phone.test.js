import { formatUSPhone, isValidUSPhone, normalizeUSPhone } from './phone';

test('normalizes and formats US phone numbers consistently', () => {
  expect(normalizeUSPhone('+1 (312) 555-0147')).toBe('3125550147');
  expect(formatUSPhone('13125550147')).toBe('(312) 555-0147');
  expect(isValidUSPhone('3125550147')).toBe(true);
  expect(isValidUSPhone('13125550147')).toBe(true);
  // Recovers numbers where leading country code 1 was prepended to 9 digits
  expect(normalizeUSPhone('1312999000')).toBe('312999000');
  expect(formatUSPhone('3125550147')).toBe('(312) 555-0147');
});

test('rejects non-US and invalid NANP numbers', () => {
  expect(isValidUSPhone('+44 20 7946 0958')).toBe(false);
  expect(isValidUSPhone('(212) 055-1234')).toBe(false);
  expect(isValidUSPhone('(012) 555-0147')).toBe(false);
});
