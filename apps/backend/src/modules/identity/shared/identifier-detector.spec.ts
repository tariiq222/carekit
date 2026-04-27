import { detectChannel, normalizeIdentifier } from './identifier-detector';

describe('detectChannel', () => {
  it('returns EMAIL when value contains @', () => {
    expect(detectChannel('a@b.com')).toBe('EMAIL');
  });

  it('returns SMS for E.164 phone', () => {
    expect(detectChannel('+966501234567')).toBe('SMS');
  });

  it('returns SMS for digits-only', () => {
    expect(detectChannel('0501234567')).toBe('SMS');
  });

  it('throws on empty string', () => {
    expect(() => detectChannel('')).toThrow('Invalid identifier');
  });

  it('throws on whitespace-only string', () => {
    expect(() => detectChannel('   ')).toThrow('Invalid identifier');
  });
});

describe('normalizeIdentifier', () => {
  it('lowercases email', () => {
    expect(normalizeIdentifier('FOO@Bar.com', 'EMAIL')).toBe('foo@bar.com');
  });

  it('trims surrounding whitespace from email', () => {
    expect(normalizeIdentifier('  foo@bar.com  ', 'EMAIL')).toBe('foo@bar.com');
  });

  it('strips whitespace from phone', () => {
    expect(normalizeIdentifier(' +966 50 123 4567 ', 'SMS')).toBe('+966501234567');
  });
});
