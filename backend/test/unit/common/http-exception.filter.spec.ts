import { GlobalExceptionFilter } from '../../../src/common/filters/http-exception.filter.js';
import * as Sentry from '@sentry/nestjs';
import { ArgumentsHost } from '@nestjs/common';

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }));

function mockHost(): ArgumentsHost {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const request = { url: '/test', method: 'GET', ip: '127.0.0.1' };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

describe('GlobalExceptionFilter — Sentry reporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should NOT send P2002 to Sentry', () => {
    const filter = new GlobalExceptionFilter();
    const err = Object.assign(new Error('unique constraint'), {
      code: 'P2002',
    });
    Object.defineProperty(err, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
    });
    filter.catch(err, mockHost());
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('should NOT send P2025 to Sentry', () => {
    const filter = new GlobalExceptionFilter();
    const err = Object.assign(new Error('record not found'), { code: 'P2025' });
    Object.defineProperty(err, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
    });
    filter.catch(err, mockHost());
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('should NOT send P2003 to Sentry', () => {
    const filter = new GlobalExceptionFilter();
    const err = Object.assign(new Error('FK constraint'), { code: 'P2003' });
    Object.defineProperty(err, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
    });
    filter.catch(err, mockHost());
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('should SEND P2034 (serialization failure) to Sentry', () => {
    const filter = new GlobalExceptionFilter();
    const err = Object.assign(
      new Error('Transaction failed due to serialization'),
      { code: 'P2034' },
    );
    Object.defineProperty(err, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
    });
    filter.catch(err, mockHost());
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  it('should SEND P2011 (null constraint) to Sentry', () => {
    const filter = new GlobalExceptionFilter();
    const err = Object.assign(new Error('null constraint'), { code: 'P2011' });
    Object.defineProperty(err, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
    });
    filter.catch(err, mockHost());
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });
});
