import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { ListVerticalsHandler } from '../../modules/platform/verticals/list-verticals.handler';
import { GetVerticalHandler } from '../../modules/platform/verticals/get-vertical.handler';
import { GetTerminologyHandler } from '../../modules/platform/verticals/get-terminology.handler';

@ApiTags('Public / Platform')
@Controller('public/verticals')
export class PublicVerticalsController {
  constructor(
    private readonly listHandler: ListVerticalsHandler,
    private readonly getHandler: GetVerticalHandler,
    private readonly getTerminology: GetTerminologyHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active verticals (public catalog)' })
  @ApiStandardResponses()
  list() {
    return this.listHandler.execute();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a vertical by slug with seed departments + categories' })
  @ApiParam({ name: 'slug', example: 'dental' })
  @ApiStandardResponses()
  get(@Param('slug') slug: string) {
    return this.getHandler.execute({ slug });
  }

  @Get(':slug/terminology')
  @ApiOperation({ summary: 'Get merged terminology pack (base family + vertical overrides)' })
  @ApiParam({ name: 'slug', example: 'dental' })
  @ApiStandardResponses()
  terminology(@Param('slug') slug: string) {
    return this.getTerminology.execute({ verticalSlug: slug });
  }
}
