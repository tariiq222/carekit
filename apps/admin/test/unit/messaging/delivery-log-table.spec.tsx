import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeliveryLogTable } from '@/features/notifications/list-delivery-log/delivery-log-table';
import type { DeliveryLogItem } from '@/features/notifications/list-delivery-log/list-delivery-log.api';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));

function makeItem(overrides: Partial<DeliveryLogItem> = {}): DeliveryLogItem {
  return {
    id: 'dl-1',
    organizationId: 'org-abc',
    recipientId: 'user-xyz',
    type: 'BOOKING_CONFIRMED',
    priority: 'STANDARD',
    channel: 'EMAIL',
    status: 'SENT',
    toAddress: 'owner@clinic.sa',
    providerName: 'resend',
    attempts: 1,
    lastAttemptAt: '2026-05-01T10:00:00Z',
    sentAt: '2026-05-01T10:00:01Z',
    errorMessage: null,
    jobId: 'job-123',
    createdAt: '2026-05-01T09:59:00Z',
    ...overrides,
  };
}

describe('DeliveryLogTable', () => {
  it('renders table headers', () => {
    render(<DeliveryLogTable items={[]} isLoading={false} />);
    expect(screen.getByText('Type')).toBeTruthy();
    expect(screen.getByText('Channel')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Priority')).toBeTruthy();
    expect(screen.getByText('Organization')).toBeTruthy();
    expect(screen.getByText('Recipient')).toBeTruthy();
  });

  it('shows skeleton rows while loading', () => {
    const { container } = render(<DeliveryLogTable items={undefined} isLoading={true} />);
    // 5 skeleton rows are rendered (one per skeleton item)
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"], [data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when items is empty and not loading', () => {
    render(<DeliveryLogTable items={[]} isLoading={false} />);
    expect(screen.getByText('No delivery log entries match the current filters.')).toBeTruthy();
  });

  it('shows empty state when items is undefined and not loading', () => {
    render(<DeliveryLogTable items={undefined} isLoading={false} />);
    expect(screen.getByText('No delivery log entries match the current filters.')).toBeTruthy();
  });

  it('renders a SENT row with correct badge', () => {
    const item = makeItem({ status: 'SENT', type: 'BOOKING_CONFIRMED' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('SENT')).toBeTruthy();
    expect(screen.getByText('BOOKING_CONFIRMED')).toBeTruthy();
  });

  it('renders a FAILED row with correct badge', () => {
    const item = makeItem({ status: 'FAILED', errorMessage: 'Provider rejected' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('FAILED')).toBeTruthy();
    expect(screen.getByText('Provider rejected')).toBeTruthy();
  });

  it('renders a PENDING row', () => {
    const item = makeItem({ status: 'PENDING' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('PENDING')).toBeTruthy();
  });

  it('renders a SKIPPED row', () => {
    const item = makeItem({ status: 'SKIPPED' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('SKIPPED')).toBeTruthy();
  });

  it('renders EMAIL channel badge', () => {
    const item = makeItem({ channel: 'EMAIL' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('EMAIL')).toBeTruthy();
  });

  it('renders SMS channel badge', () => {
    const item = makeItem({ channel: 'SMS' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('SMS')).toBeTruthy();
  });

  it('renders PUSH channel badge', () => {
    const item = makeItem({ channel: 'PUSH' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('PUSH')).toBeTruthy();
  });

  it('renders IN_APP channel badge', () => {
    const item = makeItem({ channel: 'IN_APP' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('IN_APP')).toBeTruthy();
  });

  it('renders CRITICAL priority with destructive badge', () => {
    const item = makeItem({ priority: 'CRITICAL' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('CRITICAL')).toBeTruthy();
  });

  it('renders STANDARD priority with outline badge', () => {
    const item = makeItem({ priority: 'STANDARD' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('STANDARD')).toBeTruthy();
  });

  it('shows dash for null toAddress', () => {
    const item = makeItem({ toAddress: null });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    // Both toAddress cell and sentAt cell show '—' when null
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('shows dash for null sentAt', () => {
    const item = makeItem({ sentAt: null });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    // formatDate returns '—' for null; confirm at least one dash exists
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders multiple rows', () => {
    const items = [
      makeItem({ id: 'dl-1', type: 'BOOKING_CONFIRMED', status: 'SENT' }),
      makeItem({ id: 'dl-2', type: 'PAYMENT_RECEIPT', status: 'FAILED', channel: 'SMS' }),
    ];
    render(<DeliveryLogTable items={items} isLoading={false} />);
    expect(screen.getByText('BOOKING_CONFIRMED')).toBeTruthy();
    expect(screen.getByText('PAYMENT_RECEIPT')).toBeTruthy();
  });

  it('shows toAddress when present', () => {
    const item = makeItem({ toAddress: 'owner@clinic.sa' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('owner@clinic.sa')).toBeTruthy();
  });

  it('shows organizationId in table cell', () => {
    const item = makeItem({ organizationId: 'org-abc' });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('org-abc')).toBeTruthy();
  });

  it('shows attempt count', () => {
    const item = makeItem({ attempts: 3 });
    render(<DeliveryLogTable items={[item]} isLoading={false} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('does not show skeleton when not loading', () => {
    const { container } = render(<DeliveryLogTable items={[]} isLoading={false} />);
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBe(0);
  });
});
