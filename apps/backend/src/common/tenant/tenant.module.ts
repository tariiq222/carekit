import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { RlsHelper } from './rls.helper';

@Global()
@Module({
  providers: [TenantContextService, RlsHelper],
  exports: [TenantContextService, RlsHelper],
})
export class TenantModule {}
