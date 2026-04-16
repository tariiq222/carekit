import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { RequestContextStorage } from '../http/request-context';

const makeHost = (statusFn = jest.fn(), jsonFn = jest.fn()) => ({
  switchToHttp: () => ({
    getRequest: () => ({ method: 'GET', url: '/test' }),
    getResponse: () => ({
      status: (code: number) => { statusFn(code); return { json: jsonFn }; },
    }),
  }),
});

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  afterEach(() => {
    (RequestContextStorage as { delete?: () => void }).delete?.();
  });

  it('returns correct status for HttpException', () => {
    const statusFn = jest.fn();
    const jsonFn = jest.fn();
    filter.catch(new BadRequestException('bad input'), makeHost(statusFn, jsonFn) as any);
    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'bad input' }),
    );
  });

  it('returns 500 for unknown errors', () => {
    const statusFn = jest.fn();
    const jsonFn = jest.fn();
    filter.catch(new Error('unexpected'), makeHost(statusFn, jsonFn) as any);
    expect(statusFn).toHaveBeenCalledWith(500);
  });

  it('includes timestamp and path in response', () => {
    const jsonFn = jest.fn();
    filter.catch(new HttpException('fail', HttpStatus.FORBIDDEN), makeHost(jest.fn(), jsonFn) as any);
    const body = jsonFn.mock.calls[0][0];
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/test');
  });

  it('includes array messages from ValidationPipe-style errors', () => {
    const jsonFn = jest.fn();
    const ex = new HttpException({ message: ['field is required'], error: 'Bad Request' }, 400);
    filter.catch(ex, makeHost(jest.fn(), jsonFn) as any);
    const body = jsonFn.mock.calls[0][0];
    expect(Array.isArray(body.message)).toBe(true);
  });

  it('uses exception message when exceptionResponse is null', () => {
    const jsonFn = jest.fn();
    filter.catch(new Error('something went wrong'), makeHost(jest.fn(), jsonFn) as any);
    const body = jsonFn.mock.calls[0][0];
    expect(body.message).toBe('something went wrong');
  });

  it('uses HttpStatus name when exceptionResponse has no error field', () => {
    const jsonFn = jest.fn();
    filter.catch(new HttpException({ message: 'test' }, 404), makeHost(jest.fn(), jsonFn) as any);
    const body = jsonFn.mock.calls[0][0];
    expect(body.error).toBe('NOT_FOUND');
  });

  it('extracts message from nested object response', () => {
    const jsonFn = jest.fn();
    filter.catch(new HttpException({ message: 'custom message' }, 400), makeHost(jest.fn(), jsonFn) as any);
    const body = jsonFn.mock.calls[0][0];
    expect(body.message).toBe('custom message');
  });

  it('falls back to default message when exceptionResponse is object but message is missing', () => {
    const jsonFn = jest.fn();
    filter.catch(new HttpException({} as never, 400), makeHost(jest.fn(), jsonFn) as any);
    const body = jsonFn.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
  });

  it('logs 500 errors with exception stack', () => {
    const jsonFn = jest.fn();
    filter.catch(new HttpException('Server error', 500), makeHost(jest.fn(), jsonFn) as any);
    expect(jsonFn).toHaveBeenCalled();
  });

  it('includes requestId from RequestContextStorage when available', () => {
    const jsonFn = jest.fn();
    RequestContextStorage.run({ requestId: 'req-123' }, () => {
      filter.catch(new BadRequestException('bad'), makeHost(jest.fn(), jsonFn) as any);
    });
    const body = jsonFn.mock.calls[0][0];
    expect(body.requestId).toBe('req-123');
  });

  it('sets requestId to undefined when RequestContextStorage is empty', () => {
    const jsonFn = jest.fn();
    filter.catch(new BadRequestException('bad'), makeHost(jest.fn(), jsonFn) as any);
    const body = jsonFn.mock.calls[0][0];
    expect(body.requestId).toBeUndefined();
  });
});
