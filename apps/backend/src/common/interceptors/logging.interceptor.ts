import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import {
  correlationStorage,
  CORRELATION_HEADER,
} from '../middleware/correlation-id.middleware.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{ method: string; url: string; ip: string }>();
    const { method, url, ip } = req;
    const start = Date.now();
    const correlationId = correlationStorage.getStore() ?? '-';

    return next.handle().pipe(
      tap(() => {
        const res = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        const duration = Date.now() - start;
        this.logger.log(
          `${method} ${url} ${res.statusCode} ${duration}ms — ${ip} [${CORRELATION_HEADER}=${correlationId}]`,
        );
      }),
      catchError((err: Error) => {
        const duration = Date.now() - start;
        this.logger.error(
          `${method} ${url} ERR ${duration}ms — ${ip} [${CORRELATION_HEADER}=${correlationId}] ${err.message}`,
        );
        return throwError(() => err);
      }),
    );
  }
}
