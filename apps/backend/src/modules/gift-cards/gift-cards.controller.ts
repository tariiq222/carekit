import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { RequireFeature } from '../../common/decorators/require-feature.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { GiftCardsService } from './gift-cards.service.js';
import { CreateGiftCardDto } from './dto/create-gift-card.dto.js';
import { UpdateGiftCardDto } from './dto/update-gift-card.dto.js';
import { GiftCardFilterDto } from './dto/gift-card-filter.dto.js';
import { CheckBalanceDto } from './dto/check-balance.dto.js';
import { AddCreditDto } from './dto/add-credit.dto.js';

@ApiTags('Gift Cards')
@ApiBearerAuth()
@Controller('gift-cards')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('gift_cards')
export class GiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  @Get()
  @ApiOperation({ summary: 'List all gift cards' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  @CheckPermissions({ module: 'gift-cards', action: 'view' })
  async findAll(@Query() query: GiftCardFilterDto) {
    const data = await this.giftCardsService.findAll(query);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a gift card by ID' })
  @ApiParam({ name: 'id', description: 'UUID of the gift card' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  @CheckPermissions({ module: 'gift-cards', action: 'view' })
  async findById(@Param('id', uuidPipe) id: string) {
    const data = await this.giftCardsService.findById(id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new gift card' })
  @ApiResponse({ status: 201 })
  @ApiStandardResponses()
  @CheckPermissions({ module: 'gift-cards', action: 'create' })
  async create(@Body() dto: CreateGiftCardDto) {
    const data = await this.giftCardsService.create(dto);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a gift card' })
  @ApiParam({ name: 'id', description: 'UUID of the gift card' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  @CheckPermissions({ module: 'gift-cards', action: 'edit' })
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateGiftCardDto,
  ) {
    const data = await this.giftCardsService.update(id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a gift card' })
  @ApiParam({ name: 'id', description: 'UUID of the gift card' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  @CheckPermissions({ module: 'gift-cards', action: 'delete' })
  async deactivate(@Param('id', uuidPipe) id: string) {
    const data = await this.giftCardsService.deactivate(id);
    return { success: true, data };
  }

  @Post('check-balance')
  @ApiOperation({ summary: 'Check the balance of a gift card by code' })
  @ApiResponse({ status: 201 })
  @ApiStandardResponses()
  async checkBalance(@Body() dto: CheckBalanceDto) {
    const data = await this.giftCardsService.checkBalance(dto.code);
    return { success: true, data };
  }

  @Post(':id/credit')
  @ApiOperation({ summary: 'Add credit to a gift card' })
  @ApiParam({ name: 'id', description: 'UUID of the gift card' })
  @ApiResponse({ status: 201 })
  @ApiStandardResponses()
  @CheckPermissions({ module: 'gift-cards', action: 'edit' })
  async addCredit(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AddCreditDto,
  ) {
    const data = await this.giftCardsService.addCredit(id, dto);
    return { success: true, data };
  }
}
