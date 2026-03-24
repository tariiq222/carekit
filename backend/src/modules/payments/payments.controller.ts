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
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto.js';
import { UploadReceiptDto } from './dto/upload-receipt.dto.js';
import { ReviewReceiptDto } from './dto/review-receipt.dto.js';
import { PaymentFilterDto } from './dto/payment-filter.dto.js';
import { CreateMoyasarPaymentDto } from './dto/create-moyasar-payment.dto.js';
import { MoyasarWebhookDto } from './dto/moyasar-webhook.dto.js';
import { RefundDto } from './dto/refund.dto.js';
import { BankTransferUploadDto } from './dto/bank-transfer-upload.dto.js';
import { VerifyBankTransferDto } from './dto/verify-bank-transfer.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

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
  async getPaymentStats() {
    return this.paymentsService.getPaymentStats();
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /payments/my — Patient's own payments (JWT only)
  // ═══════════════════════════════════════════════════════════════

  @Get('my')
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
  async findAll(@Query() query: PaymentFilterDto) {
    return this.paymentsService.findAll(query);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /payments/moyasar — Create Moyasar Payment (JWT)
  // ═══════════════════════════════════════════════════════════════

  @Post('moyasar')
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
  async handleMoyasarWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() dto: MoyasarWebhookDto,
  ) {
    const signature = (req.headers['x-moyasar-signature'] as string) ?? '';
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(dto));
    return this.paymentsService.handleMoyasarWebhook(signature, rawBody, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /payments/bank-transfer — Upload Bank Transfer Receipt (JWT + multer)
  // ═══════════════════════════════════════════════════════════════

  @Post('bank-transfer')
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
  async findOne(@Param('id', uuidPipe) id: string) {
    return this.paymentsService.findOne(id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PATCH /payments/:id/status — Update Payment Status
  // ═══════════════════════════════════════════════════════════════

  @Patch(':id/status')
  @CheckPermissions({ module: 'payments', action: 'edit' })
  async updateStatus(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.paymentsService.updateStatus(id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /payments/:id/receipt — Upload Bank Transfer Receipt (legacy)
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/receipt')
  @CheckPermissions({ module: 'payments', action: 'edit' })
  async uploadReceipt(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UploadReceiptDto,
  ) {
    return this.paymentsService.uploadReceipt(id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PATCH /payments/receipts/:receiptId/review — Review Receipt (legacy)
  // ═══════════════════════════════════════════════════════════════

  @Patch('receipts/:receiptId/review')
  @CheckPermissions({ module: 'payments', action: 'edit' })
  async reviewReceipt(
    @Param('receiptId', uuidPipe) receiptId: string,
    @Body() dto: ReviewReceiptDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.paymentsService.reviewReceipt(receiptId, user.id, dto);
  }
}
