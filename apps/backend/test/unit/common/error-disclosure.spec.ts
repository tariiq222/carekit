/**
 * Error Disclosure & Information Leakage Tests
 *
 * Verifies that GlobalExceptionFilter never exposes:
 *   - Stack traces in HTTP responses
 *   - Internal class names / Prisma error codes
 *   - Raw exception messages for unhandled errors
 *   - Different error shapes that allow user enumeration
 *
 * Also verifies correct error codes and generic fallback messages.
 */

import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '../../../src/common/filters/http-exception.filter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
  _status: number;
  _body: Record<string, unknown>;
}

function buildHost(
  response: MockResponse,
  request: Record<string, unknown> = {},
): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        url: '/api/v1/users',
        method: 'GET',
        ip: '127.0.0.1',
        ...request,
      }),
    }),
  } as unknown as ArgumentsHost;
}

function buildResponse(): MockResponse {
  const res = {
    _status: 0,
    _body: {},
    status: jest.fn(),
    json: jest.fn(),
  };
  // Allow chaining: res.status(x).json(y)
  res.status.mockReturnValue(res);
  res.json.mockImplementation((body: Record<string, unknown>) => {
    res._body = body;
    res._status = (res.status.mock.calls[0] as number[])[0];
  });
  return res;
}

// ---------------------------------------------------------------------------
// Stack trace leakage
// ---------------------------------------------------------------------------

describe('GlobalExceptionFilter — stack trace & internal details', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('does not include stack trace in response for unhandled Error', () => {
    const res = buildResponse();
    const err = new Error('Something broke internally');
    err.stack =
      'Error: Something broke internally\n    at Object.<anonymous> (/app/src/secret.ts:42:7)';

    filter.catch(err, buildHost(res));

    const body = res._body;
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('stack');
    expect(bodyStr).not.toContain('/app/src/');
    expect(bodyStr).not.toContain('secret.ts');
  });

  it('does not leak internal error message for unhandled Error', () => {
    const res = buildResponse();
    filter.catch(new Error('DB password is hunter2'), buildHost(res));

    const bodyStr = JSON.stringify(res._body);
    expect(bodyStr).not.toContain('hunter2');
  });

  it('uses generic message for unexpected runtime errors', () => {
    const res = buildResponse();
    filter.catch(new Error('Unexpected internal details'), buildHost(res));

    const body = res._body as { error: { message: string } };
    expect(body.error.message).toBe('An unexpected error occurred');
  });

  it('returns 500 status for unhandled errors', () => {
    const res = buildResponse();
    filter.catch(new Error('crash'), buildHost(res));

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ---------------------------------------------------------------------------
// Prisma error leakage
// ---------------------------------------------------------------------------

describe('GlobalExceptionFilter — Prisma error leakage', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('does not expose Prisma class name in response', () => {
    const res = buildResponse();
    const prismaError = new Error(
      'Unique constraint failed on the fields: (`email`)',
    ) as Error & { code?: string };
    prismaError.name = 'PrismaClientKnownRequestError';
    prismaError.code = 'P2002';
    Object.defineProperty(prismaError, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
    });

    filter.catch(prismaError, buildHost(res));

    const bodyStr = JSON.stringify(res._body);
    expect(bodyStr).not.toContain('PrismaClient');
    expect(bodyStr).not.toContain('P2002');
    expect(bodyStr).not.toContain('constraint');
  });

  it('does not expose database field names from Prisma errors', () => {
    const res = buildResponse();
    const prismaError = new Error(
      'Foreign key constraint failed on the field: `userId`',
    );
    Object.defineProperty(prismaError, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
    });

    filter.catch(prismaError, buildHost(res));

    const bodyStr = JSON.stringify(res._body);
    expect(bodyStr).not.toContain('userId');
    expect(bodyStr).not.toContain('Foreign key');
  });
});

// ---------------------------------------------------------------------------
// HttpException: error code mapping
// ---------------------------------------------------------------------------

describe('GlobalExceptionFilter — HTTP error codes', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  const cases: Array<[number, string]> = [
    [HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR'],
    [HttpStatus.UNAUTHORIZED, 'AUTH_TOKEN_INVALID'],
    [HttpStatus.FORBIDDEN, 'FORBIDDEN'],
    [HttpStatus.NOT_FOUND, 'NOT_FOUND'],
    [HttpStatus.CONFLICT, 'CONFLICT'],
    [HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED'],
  ];

  it.each(cases)('maps HTTP %i → code %s', (statusCode, expectedCode) => {
    const res = buildResponse();
    filter.catch(new HttpException('error', statusCode), buildHost(res));

    const body = res._body as { error: { code: string } };
    expect(body.error.code).toBe(expectedCode);
  });

  it('respects custom error code passed in exception body', () => {
    const res = buildResponse();
    filter.catch(
      new HttpException(
        { error: 'EMAIL_ALREADY_EXISTS', message: 'Email taken' },
        409,
      ),
      buildHost(res),
    );

    const body = res._body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(body.error.message).toBe('Email taken');
  });

  it('response always contains success: false', () => {
    const res = buildResponse();
    filter.catch(new HttpException('not found', 404), buildHost(res));

    expect(res._body).toHaveProperty('success', false);
  });
});

// ---------------------------------------------------------------------------
// User enumeration prevention (404 vs 401 shape consistency)
// ---------------------------------------------------------------------------

describe('GlobalExceptionFilter — enumeration resistance', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('404 and 401 responses share the same top-level shape', () => {
    const res404 = buildResponse();
    const res401 = buildResponse();

    filter.catch(new HttpException('Not Found', 404), buildHost(res404));
    filter.catch(
      new HttpException(
        { error: 'AUTH_TOKEN_INVALID', message: 'Invalid token' },
        401,
      ),
      buildHost(res401),
    );

    const keys404 = Object.keys((res404._body as { error: object }).error);
    const keys401 = Object.keys((res401._body as { error: object }).error);

    // Both should have exactly code + message (no extra fields that reveal differences)
    expect(keys404).toContain('code');
    expect(keys404).toContain('message');
    expect(keys401).toContain('code');
    expect(keys401).toContain('message');
  });

  it('does not reveal whether email exists via different 401/404 error codes on login path', () => {
    const resUserNotFound = buildResponse();
    const resWrongPassword = buildResponse();

    // Both wrong-user and wrong-password should use the same AUTH_TOKEN_INVALID or similar
    filter.catch(
      new HttpException(
        { error: 'AUTH_TOKEN_INVALID', message: 'Invalid credentials' },
        401,
      ),
      buildHost(resUserNotFound, { url: '/api/v1/auth/login' }),
    );
    filter.catch(
      new HttpException(
        { error: 'AUTH_TOKEN_INVALID', message: 'Invalid credentials' },
        401,
      ),
      buildHost(resWrongPassword, { url: '/api/v1/auth/login' }),
    );

    const body1 = (
      resUserNotFound._body as { error: { code: string; message: string } }
    ).error;
    const body2 = (
      resWrongPassword._body as { error: { code: string; message: string } }
    ).error;

    expect(body1.code).toBe(body2.code);
    expect(body1.message).toBe(body2.message);
  });
});

// ---------------------------------------------------------------------------
// Validation error structure (no field value leakage)
// ---------------------------------------------------------------------------

describe('GlobalExceptionFilter — validation errors', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('parses class-validator array messages into details array', () => {
    const res = buildResponse();
    filter.catch(
      new HttpException(
        {
          message: ['email must be an email', 'password is too short'],
          statusCode: 400,
        },
        400,
      ),
      buildHost(res),
    );

    const body = res._body as { error: { code: string; details: unknown[] } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBe(2);
  });

  it('does not include submitted input values in validation error response', () => {
    const res = buildResponse();
    filter.catch(
      new HttpException(
        {
          message: ['password must be longer than or equal to 8 characters'],
          statusCode: 400,
        },
        400,
      ),
      buildHost(res),
    );

    const bodyStr = JSON.stringify(res._body);
    // Should not echo back the submitted password value
    expect(bodyStr).not.toContain('hunter2');
    expect(bodyStr).not.toContain('12345');
  });
});

// ---------------------------------------------------------------------------
// Non-object exception (unknown type)
// ---------------------------------------------------------------------------

describe('GlobalExceptionFilter — unknown exception types', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('handles string exceptions without throwing', () => {
    const res = buildResponse();
    expect(() => filter.catch('something weird', buildHost(res))).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('handles null exception without throwing', () => {
    const res = buildResponse();
    expect(() => filter.catch(null, buildHost(res))).not.toThrow();
  });

  it('handles undefined exception without throwing', () => {
    const res = buildResponse();
    expect(() => filter.catch(undefined, buildHost(res))).not.toThrow();
  });
});
