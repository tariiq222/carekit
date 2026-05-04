import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Polyfills for jsdom Radix Select
beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

import { adminRequest } from '@/lib/api-client';
import { useListAuditLog } from '@/features/audit-log/list-audit-log/use-list-audit-log';
import { AuditLogTable } from '@/features/audit-log/list-audit-log/audit-log-table';
import { AuditLogFilterBar } from '@/features/audit-log/list-audit-log/audit-log-filter-bar';
import type { AuditLogEntry } from '@/features/audit-log/list-audit-log/list-audit-log.api';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'e-1',
    superAdminUserId: 'sa-1',
    actionType: 'SUSPEND_ORG',
    organizationId: 'org-1',
    impersonationSessionId: null,
    reason: 'Suspended for non-payment reasons',
    metadata: {},
    ipAddress: '1.2.3.4',
    userAgent: 'test',
    createdAt: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

describe('useListAuditLog hook', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('calls /audit-log with page params', async () => {
    const mockData = { items: [makeEntry()], meta: { page: 1, perPage: 50, total: 1, totalPages: 1 } };
    vi.mocked(adminRequest).mockResolvedValue(mockData);
    const { result } = renderHook(() => useListAuditLog({ page: 1, perPage: 50 }), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(adminRequest).toHaveBeenCalledWith(expect.stringContaining('/audit-log'));
  });
});

describe('AuditLogTable', () => {
  it('renders loading skeletons when loading', () => {
    render(<AuditLogTable items={undefined} isLoading={true} />);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('renders entry data', () => {
    render(<AuditLogTable items={[makeEntry()]} isLoading={false} />);
    expect(screen.getByText('SUSPEND_ORG')).toBeInTheDocument();
    expect(screen.getByText('org-1')).toBeInTheDocument();
    expect(screen.getByText('1.2.3.4')).toBeInTheDocument();
  });

  it('shows dash when organizationId is null', () => {
    render(<AuditLogTable items={[makeEntry({ organizationId: null })]} isLoading={false} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows empty message when items is empty', () => {
    render(<AuditLogTable items={[]} isLoading={false} />);
    expect(screen.getByText(/no audit entries/i)).toBeInTheDocument();
  });
});

describe('AuditLogFilterBar', () => {
  const onActionTypeChange = vi.fn();
  const onOrganizationIdChange = vi.fn();
  const onReset = vi.fn();

  beforeEach(() => {
    onActionTypeChange.mockReset();
    onOrganizationIdChange.mockReset();
    onReset.mockReset();
  });

  it('renders the select and org ID input', () => {
    render(
      <AuditLogFilterBar
        actionType="all"
        onActionTypeChange={onActionTypeChange}
        organizationId=""
        onOrganizationIdChange={onOrganizationIdChange}
        onReset={onReset}
      />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/organization id/i)).toBeInTheDocument();
  });

  it('calls onReset when Reset clicked', async () => {
    render(
      <AuditLogFilterBar
        actionType="SUSPEND_ORG"
        onActionTypeChange={onActionTypeChange}
        organizationId="org-1"
        onOrganizationIdChange={onOrganizationIdChange}
        onReset={onReset}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(onReset).toHaveBeenCalled();
  });

  it('calls onOrganizationIdChange when typing', async () => {
    render(
      <AuditLogFilterBar
        actionType="all"
        onActionTypeChange={onActionTypeChange}
        organizationId=""
        onOrganizationIdChange={onOrganizationIdChange}
        onReset={onReset}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/organization id/i), 'org');
    expect(onOrganizationIdChange).toHaveBeenCalled();
  });
});
