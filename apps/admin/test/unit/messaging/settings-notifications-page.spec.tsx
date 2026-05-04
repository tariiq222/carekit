import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import NotificationsSettingsPage from '@/app/(admin)/settings/notifications/page';

vi.mock('@/lib/api-client', () => ({
  adminRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string) { super(message); this.name = 'ApiError'; }
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Stable translator function — must NOT be recreated per render or the useEffect([t]) fires infinitely
const TRANSLATIONS: Record<string, string> = {
  'title': 'Notification Settings',
  'description': 'Configure platform-wide notification defaults and FCM push credentials.',
  'defaultChannels.title': 'Default Channels',
  'defaultChannels.description': 'Select which notification channels are enabled by default for all tenants.',
  'quietHours.title': 'Quiet Hours',
  'quietHours.description': 'Suppress non-urgent push notifications during these hours.',
  'quietHours.startHour': 'Start Hour (0-23)',
  'quietHours.endHour': 'End Hour (0-23)',
  'quietHours.timezone': 'Timezone',
  'fcm.title': 'FCM Credentials',
  'fcm.description': 'Firebase Cloud Messaging credentials for push notifications. Values are encrypted at rest.',
  'fcm.projectId': 'Project ID',
  'fcm.clientEmail': 'Client Email',
  'fcm.serverKey': 'Server Key (Private Key)',
  'fcm.serverKeyPlaceholder': 'Leave blank to keep existing',
  'save': 'Save settings',
  'saving': 'Saving...',
  'saveSuccess': 'Notification settings saved successfully.',
  'loadError': 'Failed to load notification settings.',
};
const stableT = (key: string) => TRANSLATIONS[key] ?? key;

vi.mock('next-intl', () => ({
  useTranslations: () => stableT,
}));

const MOCK_CONFIG = {
  defaultChannels: ['EMAIL', 'PUSH'] as const,
  quietHours: { startHour: 22, endHour: 8, timezone: 'Asia/Riyadh' },
  fcm: { serverKey: '***', projectId: 'my-firebase-project', clientEmail: 'sdk@my-project.iam.gserviceaccount.com' },
};

describe('NotificationsSettingsPage', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('shows loading skeleton while fetching', () => {
    vi.mocked(adminRequest).mockReturnValue(new Promise(() => {}));
    const { container } = render(<NotificationsSettingsPage />);
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error state when API fails to load and data is null', async () => {
    const { ApiError } = await import('@/lib/api-client');
    vi.mocked(adminRequest).mockRejectedValue(new ApiError('Service unavailable'));
    render(<NotificationsSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Service unavailable')).toBeTruthy();
    });
  });

  it('renders the form with Notification Settings heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    render(<NotificationsSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Notification Settings')).toBeTruthy();
    });
  });

  it('renders all four channel checkboxes', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    render(<NotificationsSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('EMAIL')).toBeTruthy();
      expect(screen.getByText('SMS')).toBeTruthy();
      expect(screen.getByText('PUSH')).toBeTruthy();
      expect(screen.getByText('INAPP')).toBeTruthy();
    });
  });

  it('checks channels from loaded config', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    render(<NotificationsSettingsPage />);
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      // EMAIL and PUSH should be checked; SMS and INAPP unchecked
      const emailBox = checkboxes.find((c) => {
        const label = c.closest('label');
        return label?.textContent?.includes('EMAIL');
      });
      expect(emailBox?.checked).toBe(true);
      const smsBox = checkboxes.find((c) => {
        const label = c.closest('label');
        return label?.textContent?.includes('SMS');
      });
      expect(smsBox?.checked).toBe(false);
    });
  });

  it('toggles a channel when checkbox clicked', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    const user = userEvent.setup();
    render(<NotificationsSettingsPage />);
    await waitFor(() => screen.getByText('SMS'));
    // Find SMS label and click its checkbox
    const smsLabel = screen.getByText('SMS').closest('label')!;
    const smsBox = smsLabel.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(smsBox.checked).toBe(false);
    await user.click(smsBox);
    // Re-query after state update — controlled component re-renders
    await waitFor(() => {
      const updatedBox = (screen.getByText('SMS').closest('label') as HTMLElement)
        .querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(updatedBox.checked).toBe(true);
    });
  });

  it('renders quiet hours inputs with loaded values', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    render(<NotificationsSettingsPage />);
    await waitFor(() => {
      const startInput = screen.getByDisplayValue('22') as HTMLInputElement;
      expect(startInput).toBeTruthy();
      const endInput = screen.getByDisplayValue('8') as HTMLInputElement;
      expect(endInput).toBeTruthy();
    });
  });

  it('renders FCM project ID from loaded config', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    render(<NotificationsSettingsPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('my-firebase-project')).toBeTruthy();
    });
  });

  it('renders FCM client email from loaded config', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    render(<NotificationsSettingsPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('sdk@my-project.iam.gserviceaccount.com')).toBeTruthy();
    });
  });

  it('server key input is empty when value is "***" (masked)', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    render(<NotificationsSettingsPage />);
    await waitFor(() => {
      // When serverKey === '***', the password input value is set to ''
      const serverKeyInput = screen.getByPlaceholderText('Leave blank to keep existing') as HTMLInputElement;
      expect(serverKeyInput.value).toBe('');
    });
  });

  it('saves config with correct body on form submit', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(MOCK_CONFIG) // getNotificationsConfig
      .mockResolvedValueOnce(undefined);  // updateNotificationsConfig
    const user = userEvent.setup();
    render(<NotificationsSettingsPage />);
    await waitFor(() => screen.getByText('Save settings'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => {
      expect(screen.getByText('Notification settings saved successfully.')).toBeTruthy();
    });
    const calls = vi.mocked(adminRequest).mock.calls;
    const putCall = calls[1]!;
    expect(putCall[0]).toBe('/notifications-config');
    const opts = putCall[1] as RequestInit;
    expect(opts.method).toBe('PUT');
    const body = JSON.parse(opts.body as string);
    expect(body).toHaveProperty('defaultChannels');
    expect(body).toHaveProperty('quietHours');
    expect(body).toHaveProperty('fcm');
  });

  it('shows error message when save fails', async () => {
    const { ApiError } = await import('@/lib/api-client');
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(MOCK_CONFIG)
      .mockRejectedValueOnce(new ApiError('Server error'));
    const user = userEvent.setup();
    render(<NotificationsSettingsPage />);
    await waitFor(() => screen.getByText('Save settings'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeTruthy();
    });
  });

  it('shows Saving... label on save button while in flight', async () => {
    let resolve!: () => void;
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(MOCK_CONFIG)
      .mockReturnValueOnce(new Promise((r) => { resolve = () => r(undefined); }));
    const user = userEvent.setup();
    render(<NotificationsSettingsPage />);
    await waitFor(() => screen.getByText('Save settings'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeTruthy();
    resolve();
  });

  it('does NOT include serverKey in PUT body when value is unchanged "***"', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(MOCK_CONFIG)
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<NotificationsSettingsPage />);
    await waitFor(() => screen.getByText('Save settings'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => screen.getByText('Notification settings saved successfully.'));
    const calls = vi.mocked(adminRequest).mock.calls;
    const body = JSON.parse((calls[1]![1] as RequestInit).body as string);
    // serverKey was '***', so it becomes undefined and is not sent
    expect(body.fcm.serverKey).toBeUndefined();
  });

  it('uses fallback loadError for non-ApiError exceptions during load', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('generic'));
    render(<NotificationsSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load notification settings.')).toBeTruthy();
    });
  });

  it('updates FCM projectId on input change', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    const user = userEvent.setup();
    render(<NotificationsSettingsPage />);
    await waitFor(() => screen.getByDisplayValue('my-firebase-project'));
    const projectIdInput = screen.getByDisplayValue('my-firebase-project') as HTMLInputElement;
    await user.clear(projectIdInput);
    await user.type(projectIdInput, 'new-project-id');
    expect(projectIdInput.value).toBe('new-project-id');
  });

  it('updates FCM clientEmail on input change', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    const user = userEvent.setup();
    render(<NotificationsSettingsPage />);
    await waitFor(() => screen.getByDisplayValue('sdk@my-project.iam.gserviceaccount.com'));
    const emailInput = screen.getByDisplayValue('sdk@my-project.iam.gserviceaccount.com') as HTMLInputElement;
    await user.clear(emailInput);
    await user.type(emailInput, 'new@project.iam.gserviceaccount.com');
    expect(emailInput.value).toBe('new@project.iam.gserviceaccount.com');
  });

  it('updates quiet hours startHour on input change', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    const user = userEvent.setup();
    render(<NotificationsSettingsPage />);
    await waitFor(() => screen.getByDisplayValue('22'));
    const startInput = screen.getByDisplayValue('22') as HTMLInputElement;
    await user.clear(startInput);
    await user.type(startInput, '20');
    expect(startInput.value).toBe('20');
  });

  it('updates quiet hours endHour on input change', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    const user = userEvent.setup();
    render(<NotificationsSettingsPage />);
    await waitFor(() => screen.getByDisplayValue('8'));
    const endInput = screen.getByDisplayValue('8') as HTMLInputElement;
    await user.clear(endInput);
    await user.type(endInput, '6');
    expect(endInput.value).toBe('6');
  });

  it('sends updated projectId in PUT body when changed and saved', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(MOCK_CONFIG)
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<NotificationsSettingsPage />);
    await waitFor(() => screen.getByDisplayValue('my-firebase-project'));
    const projectIdInput = screen.getByDisplayValue('my-firebase-project') as HTMLInputElement;
    await user.clear(projectIdInput);
    await user.type(projectIdInput, 'updated-project');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => screen.getByText('Notification settings saved successfully.'));
    const calls = vi.mocked(adminRequest).mock.calls;
    const body = JSON.parse((calls[1]![1] as RequestInit).body as string);
    expect(body.fcm.projectId).toBe('updated-project');
  });

  it('timezone select exists and shows Asia/Riyadh as default option', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
    render(<NotificationsSettingsPage />);
    await waitFor(() => {
      const tzSelect = screen.getByDisplayValue('Asia/Riyadh') as HTMLSelectElement;
      expect(tzSelect).toBeTruthy();
    });
  });
});
