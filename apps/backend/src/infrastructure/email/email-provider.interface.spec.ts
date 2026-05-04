import { EmailProviderNotConfiguredError } from './email-provider.interface';

describe('EmailProviderNotConfiguredError', () => {
  it('has correct name', () => {
    const error = new EmailProviderNotConfiguredError();
    expect(error.name).toBe('EmailProviderNotConfiguredError');
  });

  it('has correct message', () => {
    const error = new EmailProviderNotConfiguredError();
    expect(error.message).toBe('Email provider not configured for this organization');
  });

  it('is instance of Error', () => {
    const error = new EmailProviderNotConfiguredError();
    expect(error).toBeInstanceOf(Error);
  });

  it('can be thrown and caught', () => {
    expect(() => {
      throw new EmailProviderNotConfiguredError();
    }).toThrow(EmailProviderNotConfiguredError);
  });

  it('can be caught as Error', () => {
    expect(() => {
      throw new EmailProviderNotConfiguredError();
    }).toThrow(Error);
  });
});
