import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { GetPublicBranchesHandler } from '../../modules/org-config/branches/public/get-public-branches.handler';

@ApiTags('Public / Branches')
@ApiPublicResponses()
@Controller('public/branches')
export class PublicBranchesController {
  constructor(private readonly handler: GetPublicBranchesHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get()
  @ApiOperation({ summary: 'List active branches for the booking wizard' })
  @ApiOkResponse({ description: 'Array of public-safe branch records' })
  list() {
    return this.handler.execute();
  }
}
