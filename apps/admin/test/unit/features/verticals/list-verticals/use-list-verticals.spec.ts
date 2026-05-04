import { describe, expect, it, vi } from 'vitest';
import { useListVerticals, verticalsListKey } from '@/features/verticals/list-verticals/use-list-verticals';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    error: null,
  })),
}));

describe('useListVerticals', () => {
  it('exports correct verticalsListKey', () => {
    const key = verticalsListKey;

    expect(key).toEqual(['verticals', 'list']);
  });
});
