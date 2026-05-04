import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

const stableT = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => stableT }));

import { Sidebar } from '@/shell/sidebar';
import { LogoutButton } from '@/shell/logout-button';

describe('Sidebar', () => {
  it('renders all nav links', () => {
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /nav.overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.organizations/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.users/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.plans/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.verticals/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.billing/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.auditlog/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.impersonation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.settings/i })).toBeInTheDocument();
  });

  it('marks the overview link as active when pathname is /', () => {
    render(<Sidebar />);
    const overviewLink = screen.getByRole('link', { name: /nav.overview/i });
    expect(overviewLink).toHaveClass('bg-primary');
  });
});

describe('LogoutButton', () => {
  beforeEach(() => {
    mockPush.mockReset();
    // Clear localStorage and cookies
    window.localStorage.clear();
  });

  it('renders Sign out button', () => {
    render(<LogoutButton />);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('navigates to /login on click', async () => {
    render(<LogoutButton />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('removes accessToken from localStorage on click', async () => {
    window.localStorage.setItem('admin.accessToken', 'tok-abc');
    render(<LogoutButton />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(window.localStorage.getItem('admin.accessToken')).toBeNull();
  });
});
