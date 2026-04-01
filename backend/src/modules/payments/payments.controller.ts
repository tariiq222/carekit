import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto.js';
import { PaymentFilterDto } from './dto/payment-filter.dto.js';
import { CreateMoyasarPaymentDto } from './dto/create-moyasar-payment.dto.js';
import { MoyasarWebhookDto } from './dto/moyasar-webhook.dto.js';
import { RefundDto } from './dto/refund.dto.js';
import { BankTransferUploadDto } from './dto/bank-transfer-upload.dto.js';
import { VerifyBankTransferDto } from './dto/verify-bank-transfer.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { validateFileContent } from '../../common/helpers/file-validation.helper.js';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET /payments/stats — Payment Statistics (must be before :id)
  // ═══════════════════════════════════════════════════════════════

  @Get('stats')
  @CheckPermissions({ module: 'payments', action: 'view' })
  @ApiOperation({ summary: 'Get payment statistics overview' })
  async getPaymentStats() {
    return this.paymentsService.getPaymentStats();
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /payments/my — Patient's own payments (JWT only)
  // ═══════════════════════════════════════════════════════════════

  @Get('my')
  @ApiOperation({ summary: "Get current patient's own payments" })
  async getMyPayments(
    @CurrentUser() user: { id: string },
    @Query() query: PaymentFilterDto,
  ) {
    return this.paymentsService.getMyPayments(user.id, query);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /payments/booking/:bookingId — Payment by Booking
  // ═══════════════════════════════════════════════════════════════

  @Get('booking/:bookingId')
  @CheckPermissions({ module: 'payments', action: 'view' })
  @ApiOperation({ summary: 'Get payment by booking ID' })
  async findPaymentByBooking(
    @Param('bookingId', uuidPipe) bookingId: string,
  ) {
    return this.paymentsService.findPaymentByBooking(bookingId);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /payments — List Payments
  // ═══════════════════════════════════════════════════════════════

  @Get()
  @CheckPermissions({ module: 'payments', action: 'view' })
  @ApiOperation({ summary: 'List payments with filters and pagination' })
  async findAll(@Query() query: PaymentFilterDto) {
    return this.paymentsService.findAll(query);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /payments/moyasar — Create Moyasar Payment (JWT)
  // ═══════════════════════════════════════════════════════════════

  @Post('moyasar')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a Moyasar payment' })
  async createMoyasarPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateMoyasarPaymentDto,
  ) {
    return this.paymentsService.createMoyasarPayment(user.id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /payments/moyasar/webhook — Moyasar Webhook (PUBLIC)
  // ═══════════════════════════════════════════════════════════════

  @Post('moyasar/webhook')
  @Public()
  @ApiOperation({ summary: 'Handle Moyasar payment webhook' })
  async handleMoyasarWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() dto: MoyasarWebhookDto,
  ) {
    const signature = (req.headers['x-moyasar-signature'] as string) ?? '';
    if (!req.rawBody) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Raw request body is required for webhook signature verification',
        error: 'RAW_BODY_MISSING',
      });
    }
    return this.paymentsService.handleMoyasarWebhook(signature, req.rawBody, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /payments/bank-transfer — Upload Bank Transfer Receipt (JWT + multer)
  // ═══════════════════════════════════════════════════════════════

  @Post('bank-transfer')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Upload bank transfer receipt' })
  @UseInterceptors(FileInterceptor('receipt', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: unknown, file: { mimetype: string }, cb: (err: Error | null, accept: boolean) => void) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException({
          statusCode: 400,
          message: 'Only JPEG, PNG, WebP, and PDF files are allowed',
          error: 'INVALID_FILE_TYPE',
        }), false);
      }
    },
  }))
  async uploadBankTransferReceipt(
    @CurrentUser() user: { id: string },
    @Body() dto: BankTransferUploadDto,
    @Req() req: Request & { file?: Express.Multer.File },
  ) {
    if (!req.file) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Receipt file is required',
        error: 'MISSING_FILE',
      });
    }
    validateFileContent(req.file.buffer, req.file.mimetype);
    return this.paymentsService.uploadBankTransferReceipt(
      user.id,
      dto.bookingId,
      req.file,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /payments/bank-transfer/:id/verify — Verify Bank Transfer (PERMISSION:edit)
  // ═══════════════════════════════════════════════════════════════

  @Post('bank-transfer/:id/verify')
  @CheckPermissions({ module: 'payments', action: 'edit' })
  @ApiOperation({ summary: 'Verify a bank transfer receipt' })
  async verifyBankTransfer(
    @Param('id', uuidPipe) receiptId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyBankTransferDto,
  ) {
    return this.paymentsService.verifyBankTransfer(receiptId, user.id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /payments/:id/refund — Refund Payment (PERMISSION:edit)
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/refund')
  @CheckPermissions({ module: 'payments', action: 'edit' })
  @ApiOperation({ summary: 'Refund a payment' })
  async refund(
    @Param('id', uuidPipe) id: string,
    @Body() dto: RefundDto,
  ) {
    return this.paymentsService.refund(id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /payments/:id — Payment Details
  // ═══════════════════════════════════════════════════════════════

  @Get(':id')
  @CheckPermissions({ module: 'payments', action: 'view' })
  @ApiOperation({ summary: 'Get payment details by ID' })
  async findOne(@Param('id', uuidPipe) id: string) {
    return this.paymentsService.findOne(id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PATCH /payments/:id/status — Update Payment Status
  // ═══════════════════════════════════════════════════════════════

  @Patch(':id/status')
  @CheckPermissions({ module: 'payments', action: 'edit' })
  @ApiOperation({ summary: 'Update payment status' })
  async updateStatus(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.paymentsService.updateStatus(id, dto);
  }

}
