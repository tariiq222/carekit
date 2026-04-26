import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiResponse } from '@nestjs/swagger';
import { ApiPublicResponses, ApiErrorDto } from '../../common/swagger';
import { RegisterTenantDto } from '../../modules/platform/tenant-registration/register-tenant.dto';
import { RegisterTenantHandler } from '../../modules/platform/tenant-registration/register-tenant.handler';

@ApiTags('Public / Tenants')
@ApiPublicResponses()
@Controller('tenants')
export class PublicTenantsController {
  constructor(private readonly registerTenant: RegisterTenantHandler) {}

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new tenant organization with a 14-day free trial' })
  @ApiCreatedResponse({ description: 'Organization created; returns access + refresh tokens' })
  @ApiResponse({ status: 409, description: 'Email already registered', type: ApiErrorDto })
  async registerEndpoint(@Body() dto: RegisterTenantDto) {
    return this.registerTenant.execute(dto);
  }
}
