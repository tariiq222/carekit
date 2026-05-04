import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { adminRequest } from '@/lib/api-client';
import { useListVerticals } from '@/features/verticals/list-verticals/use-list-verticals';
import { VerticalsTable } from '@/features/verticals/list-verticals/verticals-table';
import type { VerticalRow } from '@/features/verticals/types';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

function makeVertical(overrides: Partial<VerticalRow> = {}): VerticalRow {
  return {
    id: 'v-1',
    slug: 'dental',
    nameAr: 'أسنان',
    nameEn: 'Dental',
    templateFamily: 'MEDICAL',
    descriptionAr: null,
    descriptionEn: null,
    iconUrl: null,
    isActive: true,
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('useListVerticals hook', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('calls /verticals and returns data', async () => {
    const data = [makeVertical()];
    vi.mocked(adminRequest).mockResolvedValue(data);
    const { result } = renderHook(() => useListVerticals(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(adminRequest).toHaveBeenCalledWith('/verticals');
  });
});

describe('VerticalsTable', () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    onEdit.mockReset();
    onDelete.mockReset();
  });

  function renderTable(items: VerticalRow[] | undefined, isLoading = false) {
    render(<VerticalsTable items={items} isLoading={isLoading} onEdit={onEdit} onDelete={onDelete} />);
  }

  it('renders loading skeletons when isLoading=true and items undefined', () => {
    renderTable(undefined, true);
    const rows = screen.getAllByRole('row');
    // header + 4 skeleton rows
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('renders vertical row data when items are provided', () => {
    renderTable([makeVertical()]);
    expect(screen.getByText('dental')).toBeInTheDocument();
    expect(screen.getByText('أسنان')).toBeInTheDocument();
    expect(screen.getByText('Dental')).toBeInTheDocument();
    expect(screen.getByText('MEDICAL')).toBeInTheDocument();
  });

  it('shows active badge for active vertical', () => {
    renderTable([makeVertical({ isActive: true })]);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows inactive badge for inactive vertical', () => {
    renderTable([makeVertical({ isActive: false })]);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('calls onEdit when Edit button clicked', async () => {
    const vertical = makeVertical();
    renderTable([vertical]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(vertical);
  });

  it('calls onDelete when Delete button clicked', async () => {
    const vertical = makeVertical();
    renderTable([vertical]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(vertical);
  });

  it('shows empty message when items is empty array', () => {
    renderTable([]);
    expect(screen.getByText(/no verticals defined/i)).toBeInTheDocument();
  });
});
