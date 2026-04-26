import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import OtpVerifyScreen from '../otp-verify';

// --- Mocks ---

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({ email: 'test@example.com' }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'auth.otpBoxLabel') {
        return `OTP digit ${options.index} of ${options.total}`;
      }
      return key;
    },
  }),
}));

const mockDispatch = jest.fn();
jest.mock('@/hooks/use-redux', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: jest.fn(),
}));

jest.mock('@/stores/slices/auth-slice', () => ({
  setCredentials: jest.fn(),
  setLoading: jest.fn(),
}));

jest.mock('@/services/auth', () => ({
  authService: {
    sendOtp: jest.fn().mockResolvedValue({ success: true }),
    verifyOtp: jest.fn().mockResolvedValue({
      success: true,
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { role: 'CLIENT' },
      },
    }),
  },
}));

jest.mock('@/types/auth', () => ({
  getPrimaryRole: jest.fn().mockReturnValue('client'),
}));

jest.mock('@/lib/onboarding', () => ({
  hasSeenOnboarding: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => <>{children}</>,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        surface: '#FFF',
        surfaceHigh: '#EEE',
        textPrimary: '#000',
        textSecondary: '#666',
        textMuted: '#999',
      },
    },
    isRTL: false,
  }),
}));

import { authService } from '@/services/auth';

describe('OtpVerifyScreen Autofill & Auto-submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders 6 OTP input boxes with correct autofill attributes', () => {
    const { getAllByPlaceholderText, queryAllByDisplayValue, getByLabelText } = render(<OtpVerifyScreen />);
    
    // We have 6 boxes
    for (let i = 1; i <= 6; i++) {
      const input = getByLabelText(`OTP digit ${i} of 6`);
      expect(input.props.textContentType).toBe('oneTimeCode');
      expect(input.props.autoComplete).toBe('sms-otp');
      expect(input.props.keyboardType).toBe('number-pad');
    }
  });

  it('auto-submits when all 6 digits are filled', async () => {
    const { getByLabelText } = render(<OtpVerifyScreen />);
    
    // Fill first 5 digits
    for (let i = 1; i <= 5; i++) {
      fireEvent.changeText(getByLabelText(`OTP digit ${i} of 6`), i.toString());
    }
    
    // verifyOtp should not have been called yet
    expect(authService.verifyOtp).not.toHaveBeenCalled();
    
    // Fill the last digit
    fireEvent.changeText(getByLabelText('OTP digit 6 of 6'), '6');
    
    // Wait for auto-submit
    await waitFor(() => {
      expect(authService.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        code: '123456',
      });
    });
  });

  it('handles paste and auto-submits', async () => {
    const { getByLabelText } = render(<OtpVerifyScreen />);
    
    // Paste 6 digits into the first box
    fireEvent.changeText(getByLabelText('OTP digit 1 of 6'), '654321');
    
    // Wait for auto-submit
    await waitFor(() => {
      expect(authService.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        code: '654321',
      });
    });
  });
});
