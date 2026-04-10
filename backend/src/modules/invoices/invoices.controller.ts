import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { type Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { InvoicesService } from './invoices.service.js';
import { InvoiceCreatorService } from './invoice-creator.service.js';
import { InvoiceStatsService } from './invoice-stats.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { InvoiceFilterDto } from './dto/invoice-filter.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly creatorService: InvoiceCreatorService,
    private readonly statsService: InvoiceStatsService,
  ) {}

  @Get('stats')
  @CheckPermissions({ module: 'invoices', action: 'view' })
  @ApiOperation({
    summary: 'Get invoice statistics including ZATCA status breakdown',
  })
  @ApiResponse({ status: 200, description: 'Invoice statistics' })
  @ApiStandardResponses()
  getStats() {
    return this.statsService.getInvoiceStats();
  }

  @Get('payment/:paymentId')
  @CheckPermissions({ module: 'invoices', action: 'view' })
  @ApiOperation({ summary: 'Get invoice by payment ID' })
  @ApiResponse({ status: 200, description: 'Invoice record' })
  @ApiStandardResponses()
  findByPayment(@Param('paymentId', uuidPipe) paymentId: string) {
    return this.invoicesService.findByPayment(paymentId);
  }

  @Get()
  @CheckPermissions({ module: 'invoices', action: 'view' })
  @ApiOperation({ summary: 'List invoices with optional ZATCA status filter' })
  @ApiResponse({ status: 200, description: 'Paginated invoices list' })
  @ApiStandardResponses()
  findAll(@Query() query: InvoiceFilterDto) {
    return this.invoicesService.findAll(query);
  }

  @Get(':id')
  @CheckPermissions({ module: 'invoices', action: 'view' })
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiResponse({ status: 200, description: 'Invoice details' })
  @ApiStandardResponses()
  findOne(@Param('id', uuidPipe) id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'invoices', action: 'create' })
  @ApiOperation({
    summary: 'Create invoice (generates ZATCA QR Code automatically)',
  })
  @ApiResponse({ status: 201, description: 'Invoice created' })
  @ApiStandardResponses()
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.creatorService.createInvoice(dto);
  }

  @Get(':id/html')
  @CheckPermissions({ module: 'invoices', action: 'view' })
  @ApiOperation({
    summary: 'Get invoice as HTML (for browser print / PDF generation)',
  })
  @ApiResponse({ status: 200, description: 'Invoice HTML document' })
  @ApiStandardResponses()
  async getInvoiceHtml(
    @Param('id', uuidPipe) id: string,
    @Res() res: Response,
  ) {
    const html = await this.creatorService.generateInvoiceHtml(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Patch(':id/send')
  @HttpCode(200)
  @CheckPermissions({ module: 'invoices', action: 'edit' })
  @ApiOperation({ summary: 'Mark invoice as sent' })
  @ApiResponse({ status: 200, description: 'Invoice marked as sent' })
  @ApiStandardResponses()
  markAsSent(@Param('id', uuidPipe) id: string) {
    return this.invoicesService.markAsSent(id);
  }
}
