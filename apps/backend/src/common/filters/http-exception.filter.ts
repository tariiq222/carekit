import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestContextStorage } from '../tenant/request-context';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId: string | undefined;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)['message'] ?? 'Internal server error'
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const error =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)['error'] ?? HttpStatus[status]
        : HttpStatus[status];

    const requestContext = RequestContextStorage.get();

    const body: ErrorResponse = {
      statusCode: status,
      error: String(error),
      message: message as string | string[],
      requestId: requestContext?.requestId,
      timestamp: new Date().toISOString(),
      path: req.url,
    };

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json(body);
  }
}
