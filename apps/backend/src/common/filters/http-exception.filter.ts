import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';
import { RequestContextStorage } from '../http/request-context';
import { TenantContextService } from '../tenant/tenant-context.service';

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

  // Optional so the filter can still be constructed in narrow unit-test
  // setups without wiring the full TenantModule.
  constructor(@Optional() private readonly tenant?: TenantContextService) {}

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
      this.captureWithScope(exception, req, status, requestContext);
    }

    res.status(status).json(body);
  }

  /**
   * Attach request/tenant/user tags so Sentry issues are filterable by
   * org and traceable back to a specific request without spelunking logs.
   */
  private captureWithScope(
    exception: unknown,
    req: Request,
    status: number,
    requestContext: ReturnType<typeof RequestContextStorage.get>,
  ): void {
    const tenantCtx = this.tenant?.get();
    const userId = requestContext?.userId ?? tenantCtx?.id;
    const organizationId = tenantCtx?.organizationId;
    const membershipId = tenantCtx?.membershipId;

    Sentry.withScope((scope) => {
      scope.setTag('http.method', req.method);
      scope.setTag('http.status', String(status));
      if (requestContext?.requestId) {
        scope.setTag('request.id', requestContext.requestId);
      }
      if (organizationId) scope.setTag('organization.id', organizationId);
      if (membershipId) scope.setTag('membership.id', membershipId);
      if (tenantCtx?.role) scope.setTag('user.role', tenantCtx.role);
      if (userId) scope.setUser({ id: userId });
      scope.setContext('request', {
        method: req.method,
        path: req.url,
        requestId: requestContext?.requestId,
        ip: requestContext?.ip,
      });
      Sentry.captureException(exception);
    });
  }
}
