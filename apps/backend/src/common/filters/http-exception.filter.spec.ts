import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

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
});
