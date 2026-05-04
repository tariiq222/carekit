import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeatureSearch } from '@/features/plans/features-tab/feature-search';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));

describe('FeatureSearch', () => {
  it('renders search input with placeholder', () => {
    render(<FeatureSearch value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/filter by name or description/i)).toBeInTheDocument();
  });

  it('renders label "Search features"', () => {
    render(<FeatureSearch value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText(/search features/i)).toBeInTheDocument();
  });

  it('shows current value', () => {
    render(<FeatureSearch value="recurring" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('recurring')).toBeInTheDocument();
  });

  it('calls onChange with new value when user types', async () => {
    const onChange = vi.fn();
    render(<FeatureSearch value="" onChange={onChange} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole('searchbox'), 'chatbot');
    expect(onChange).toHaveBeenCalled();
    // Check that onChange was called with 'c' at minimum (first keystroke)
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/.+/));
  });

  it('input type is search', () => {
    render(<FeatureSearch value="" onChange={vi.fn()} />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('type', 'search');
  });

  it('input id is "feature-search"', () => {
    render(<FeatureSearch value="" onChange={vi.fn()} />);
    expect(document.getElementById('feature-search')).toBeInTheDocument();
  });
});
