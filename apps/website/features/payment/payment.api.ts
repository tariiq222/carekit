const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100';

export async function initGuestPayment(
  bookingId: string,
  sessionToken: string,
): Promise<{ paymentId: string; redirectUrl: string }> {
  const res = await fetch(`${API_BASE}/public/payments/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ bookingId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Payment init failed');
  }
  const json = await res.json();
  return (json.data ?? json) as { paymentId: string; redirectUrl: string };
}

export async function getPublicBranding(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/public/branding`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Failed to fetch branding: ${res.status}`);
  return res.json();
}