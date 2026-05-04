import { SmsProviderNotConfiguredError } from './sms-provider.interface';

describe('SmsProviderNotConfiguredError', () => {
  it('has correct name', () => {
    const error = new SmsProviderNotConfiguredError();
    expect(error.name).toBe('SmsProviderNotConfiguredError');
  });

  it('has correct message', () => {
    const error = new SmsProviderNotConfiguredError();
    expect(error.message).toBe('SMS provider not configured for this organization');
  });

  it('is instance of Error', () => {
    const error = new SmsProviderNotConfiguredError();
    expect(error).toBeInstanceOf(Error);
  });

  it('can be thrown and caught', () => {
    expect(() => {
      throw new SmsProviderNotConfiguredError();
    }).toThrow(SmsProviderNotConfiguredError);
  });

  it('can be caught as Error', () => {
    expect(() => {
      throw new SmsProviderNotConfiguredError();
    }).toThrow(Error);
  });
});
