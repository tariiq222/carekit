import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { InvoicesService } from './invoices.service.js';
import { InvoiceCreatorService } from './invoice-creator.service.js';
import { InvoiceStatsService } from './invoice-stats.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { InvoiceFilterDto } from './dto/invoice-filter.dto.js';

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      statusCode: 400,
      message: 'Invalid UUID format',
      error: 'VALIDATION_ERROR',
    }),
});

@ApiTags('Invoices')
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
  @ApiOperation({ summary: 'Get invoice statistics including ZATCA status breakdown' })
  getStats() {
    return this.statsService.getInvoiceStats();
  }

  @Get('payment/:paymentId')
  @CheckPermissions({ module: 'invoices', action: 'view' })
  @ApiOperation({ summary: 'Get invoice by payment ID' })
  findByPayment(@Param('paymentId', uuidPipe) paymentId: string) {
    return this.invoicesService.findByPayment(paymentId);
  }

  @Get()
  @CheckPermissions({ module: 'invoices', action: 'view' })
  @ApiOperation({ summary: 'List invoices with optional ZATCA status filter' })
  findAll(@Query() query: InvoiceFilterDto) {
    return this.invoicesService.findAll(query);
  }

  @Get(':id')
  @CheckPermissions({ module: 'invoices', action: 'view' })
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@Param('id', uuidPipe) id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'invoices', action: 'create' })
  @ApiOperation({ summary: 'Create invoice (generates ZATCA QR Code automatically)' })
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.creatorService.createInvoice(dto);
  }

  @Get(':id/html')
  @CheckPermissions({ module: 'invoices', action: 'view' })
  @ApiOperation({ summary: 'Get invoice as HTML (for browser print / PDF generation)' })
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
  markAsSent(@Param('id', uuidPipe) id: string) {
    return this.invoicesService.markAsSent(id);
  }
}
