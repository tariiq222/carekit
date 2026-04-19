import type { CreateContactMessagePayload } from '@carekit/api-client';

const API_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:5100';

export async function submitContactMessage(payload: CreateContactMessagePayload): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/public/contact-messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Submission failed: ${res.status}`);
  }
}
