import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{ method: string; url: string; ip: string }>();
    const { method, url, ip } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        const duration = Date.now() - start;
        this.logger.log(
          `${method} ${url} ${res.statusCode} ${duration}ms — ${ip}`,
        );
      }),
    );
  }
}
