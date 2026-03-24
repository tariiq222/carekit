import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{ method: string; route?: { path: string }; url: string }>();

    const method = req.method;
    // Prefer the route pattern (e.g. /api/v1/users/:id) over the actual URL
    // to avoid high-cardinality label explosion in Prometheus.
    const route = req.route?.path ?? req.url;
    const end = this.metrics.httpRequestDuration.startTimer({ method, route });

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context
            .switchToHttp()
            .getResponse<{ statusCode: number }>();
          const statusCode = String(res.statusCode);
          this.metrics.httpRequestsTotal.inc({ method, route, status_code: statusCode });
          end();
        },
        error: () => {
          // On error the exception filter sets the status code, but
          // we still record the duration. Count is handled by the filter
          // pipeline — the status code here would be unreliable, so we
          // record a generic "error" bucket to keep cardinality low.
          this.metrics.httpRequestsTotal.inc({ method, route, status_code: 'error' });
          end();
        },
      }),
    );
  }
}
