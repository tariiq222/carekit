import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock the hCaptcha widget — it loads a remote script and won't work in jsdom.
vi.mock('@hcaptcha/react-hcaptcha', () => ({
  default: vi.fn(({ onVerify }: { onVerify: (token: string) => void }) => (
    <button
      data-testid="mock-hcaptcha"
      onClick={() => onVerify('test-captcha-token')}
    >
      Verify Captcha
    </button>
  )),
}));

// Mock the OTP API so we don't hit the network.
vi.mock('./otp.api', () => ({
  requestOtp: vi.fn().mockResolvedValue(undefined),
}));

import { OtpRequestForm } from './otp-request-form';
import type { GuestClientInfo } from '@carekit/shared';

const client: GuestClientInfo = { name: 'Ahmed', phone: '+966500000000', email: 'ahmed@test.com' };

describe('OtpRequestForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables Send button when hcaptchaToken is null', () => {
    render(
      <OtpRequestForm
        client={client}
        hcaptchaToken={null}
        onHcaptchaVerify={vi.fn()}
        onRequestSent={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /send verification code/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('enables Send button when hcaptchaToken is present', () => {
    render(
      <OtpRequestForm
        client={client}
        hcaptchaToken="some-token"
        onHcaptchaVerify={vi.fn()}
        onRequestSent={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /send verification code/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('calls onHcaptchaVerify when hCaptcha widget fires onVerify', () => {
    const onVerify = vi.fn();
    render(
      <OtpRequestForm
        client={client}
        hcaptchaToken={null}
        onHcaptchaVerify={onVerify}
        onRequestSent={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('mock-hcaptcha'));
    expect(onVerify).toHaveBeenCalledWith('test-captcha-token');
  });

  it('calls onRequestSent after successful OTP request', async () => {
    const onRequestSent = vi.fn();
    render(
      <OtpRequestForm
        client={client}
        hcaptchaToken="valid-token"
        onHcaptchaVerify={vi.fn()}
        onRequestSent={onRequestSent}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));
    await waitFor(() => expect(onRequestSent).toHaveBeenCalled());
  });
});
