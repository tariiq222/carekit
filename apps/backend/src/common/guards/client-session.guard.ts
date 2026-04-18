import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ClientSessionGuard extends AuthGuard('client-jwt') {
  canActivate(ctx: ExecutionContext) {
    return super.canActivate(ctx);
  }

  handleRequest<TClient>(
    err: Error | null,
    client: TClient,
    _info: unknown,
    _ctx: ExecutionContext,
  ): TClient {
    if (err || !client) {
      throw new UnauthorizedException('Invalid or expired client session');
    }
    return client;
  }
}
