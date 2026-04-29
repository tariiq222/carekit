export type AuthChannel = 'SMS' | 'EMAIL';

export function detectChannel(value: string): AuthChannel {
  if (!value || !value.trim()) {
    throw new Error('Invalid identifier');
  }
  return value.includes('@') ? 'EMAIL' : 'SMS';
}

export function normalizeIdentifier(value: string, channel: AuthChannel): string {
  if (channel === 'EMAIL') return value.trim().toLowerCase();
  const stripped = value.replace(/\s+/g, '').replace(/^00/, '+');
  if (stripped.startsWith('+966')) return '0' + stripped.slice(4);
  if (stripped.startsWith('966') && stripped.length === 12) return '0' + stripped.slice(3);
  return stripped;
}
