export type AuthChannel = 'SMS' | 'EMAIL';

export function detectChannel(value: string): AuthChannel {
  if (!value || !value.trim()) {
    throw new Error('Invalid identifier');
  }
  return value.includes('@') ? 'EMAIL' : 'SMS';
}

export function normalizeIdentifier(value: string, channel: AuthChannel): string {
  if (channel === 'EMAIL') return value.trim().toLowerCase();
  return value.replace(/\s+/g, '');
}
