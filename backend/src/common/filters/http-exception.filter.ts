import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ValidationErrorDetail {
  field: string;
  message: string;
}

interface ExceptionResponseObject {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: ValidationErrorDetail[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      // Log auth failures for audit trail (401, 403)
      if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
        const request = ctx.getRequest<{ url?: string; method?: string; ip?: string }>();
        this.logger.warn(
          `Auth failure [${status}] ${request.method} ${request.url} — IP: ${request.ip}`,
        );
      }

      // Log server errors (5xx) for debugging
      if (status >= 500) {
        const request = ctx.getRequest<{ url?: string; method?: string }>();
        this.logger.error(
          `Server error [${status}] ${request.method} ${request.url}: ${exception.message}`,
          exception.stack,
        );
      }

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = this.getErrorCode(status, 'INTERNAL_ERROR');
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as ExceptionResponseObject;

        // Check for custom error code passed via the 'error' field
        if (responseObj.error && typeof responseObj.error === 'string') {
          code = responseObj.error;
        }

        // Handle class-validator validation errors (array of messages)
        if (Array.isArray(responseObj.message) && status === HttpStatus.BAD_REQUEST) {
          code = 'VALIDATION_ERROR';
          details = responseObj.message.map((msg: string) => {
            const parts = msg.split(' ');
            const field = parts[0] ?? 'unknown';
            return { field, message: msg };
          });
          message = 'Request validation failed';
        } else {
          message = Array.isArray(responseObj.message)
            ? responseObj.message[0] ?? 'Validation failed'
            : (typeof responseObj.message === 'string'
                ? responseObj.message
                : exception.message);
        }

        // If no custom code was set, derive from status
        if (code === 'INTERNAL_ERROR' && !responseObj.error) {
          code = this.getErrorCode(status, 'INTERNAL_ERROR');
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error('Unknown exception type', String(exception));
    }

    const errorResponse: Record<string, unknown> = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    };

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number, fallback: string): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_TOKEN_INVALID';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return fallback;
    }
  }
}
