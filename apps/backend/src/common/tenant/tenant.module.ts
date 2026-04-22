import { Global, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantContextService } from './tenant-context.service';
import { RlsHelper } from './rls.helper';
import { TenantEnforcementMode } from './tenant.constants';

@Global()
@Module({
  providers: [TenantContextService, RlsHelper],
  exports: [TenantContextService, RlsHelper],
})
export class TenantModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenantModule.name);

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const mode = this.config.get<TenantEnforcementMode>('TENANT_ENFORCEMENT', 'strict');
    const env = process.env.NODE_ENV ?? 'development';

    if (mode !== 'strict' && env === 'production') {
      this.logger.error(
        `TENANT_ENFORCEMENT=${mode} is set in production — this is a security risk. Set to 'strict'.`,
      );
      return;
    }
    if (mode !== 'strict' && env !== 'development' && env !== 'test') {
      this.logger.warn(
        `TENANT_ENFORCEMENT=${mode} — only 'strict' is supported outside development.`,
      );
    }
  }
}
