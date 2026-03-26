import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Guards the Prometheus /metrics endpoint.
 *
 * Checks for Authorization: Bearer <METRICS_TOKEN>.
 * If METRICS_TOKEN is not set the endpoint is blocked entirely in all
 * environments — callers must explicitly configure the token.
 */
@Injectable()
export class MetricsAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const token = this.config.get<string>('METRICS_TOKEN');

    if (!token) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Metrics endpoint is not configured',
        error: 'METRICS_NOT_CONFIGURED',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'] ?? '';
    const provided = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : '';

    if (provided !== token) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid metrics token',
        error: 'METRICS_UNAUTHORIZED',
      });
    }

    return true;
  }
}
