import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock the hook to return an error state
vi.mock('@/features/platform-metrics/get-platform-metrics/use-get-platform-metrics', () => ({
  useGetPlatformMetrics: vi.fn(),
}));

import { useGetPlatformMetrics } from '@/features/platform-metrics/get-platform-metrics/use-get-platform-metrics';
import { MetricsGrid } from '@/features/platform-metrics/get-platform-metrics/metrics-grid';

describe('MetricsGrid error state', () => {
  it('shows error card when hook returns an error', () => {
    vi.mocked(useGetPlatformMetrics).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('metrics failed'),
    } as any);

    render(<MetricsGrid />);
    expect(screen.getByText(/failed to load metrics/i)).toBeInTheDocument();
    expect(screen.getByText(/metrics failed/)).toBeInTheDocument();
  });
});
