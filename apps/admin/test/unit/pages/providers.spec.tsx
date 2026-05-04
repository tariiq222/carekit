import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ Toaster: () => null }));
vi.mock('@tanstack/react-query-devtools', () => ({ ReactQueryDevtools: () => null }));

import { Providers } from '@/app/providers';

describe('Providers', () => {
  it('renders children', () => {
    render(
      <Providers>
        <div>test content</div>
      </Providers>,
    );
    expect(screen.getByText('test content')).toBeInTheDocument();
  });

  it('renders with ltr direction', () => {
    const { container } = render(
      <Providers dir="ltr">
        <div>ltr content</div>
      </Providers>,
    );
    expect(screen.getByText('ltr content')).toBeInTheDocument();
  });

  it('renders with rtl direction', () => {
    render(
      <Providers dir="rtl">
        <div>rtl content</div>
      </Providers>,
    );
    expect(screen.getByText('rtl content')).toBeInTheDocument();
  });
});
