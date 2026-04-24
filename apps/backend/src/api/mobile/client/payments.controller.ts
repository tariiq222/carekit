import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam,
  ApiOkResponse, ApiResponse, ApiProperty, ApiPropertyOptional,
  ApiConsumes, ApiBody, ApiCreatedResponse,
} from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { ApiStandardResponses, ApiErrorDto } from '../../../common/swagger';
import { ListPaymentsHandler } from '../../../modules/finance/list-payments/list-payments.handler';
import { GetInvoiceHandler } from '../../../modules/finance/get-invoice/get-invoice.handler';
import { BankTransferUploadHandler } from '../../../modules/finance/bank-transfer-upload/bank-transfer-upload.handler';

export class MobileListPaymentsQuery {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Records per page', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class MobileBankTransferUploadDto {
  @ApiProperty({ description: 'Invoice being paid', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() invoiceId!: string;

  @ApiProperty({ description: 'Transfer amount', example: 100.00 })
  @IsNumber() @Min(0) @Type(() => Number) amount!: number;
}

@ApiTags('Mobile Client / Payments')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Controller('mobile/client/payments')
export class MobileClientPaymentsController {
  constructor(
    private readonly listPayments: ListPaymentsHandler,
    private readonly getInvoice: GetInvoiceHandler,
    private readonly bankTransferUpload: BankTransferUploadHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated client\'s payments' })
  @ApiOkResponse({ description: 'Paginated payment list for the current client' })
  listMyPayments(
    @ClientSession() user: ClientSession,
    @Query() q: MobileListPaymentsQuery,
  ) {
    return this.listPayments.execute({
      clientId: user.id,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get an invoice by id (client-scoped)' })
  @ApiParam({ name: 'id', description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Invoice found' })
  @ApiResponse({ status: 404, description: 'Invoice not found', type: ApiErrorDto })
  getInvoiceEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getInvoice.execute({ invoiceId: id });
  }

  @Post('bank-transfer')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('receipt'))
  @ApiOperation({ summary: 'Upload a bank-transfer receipt for an invoice (client)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Receipt file + invoice metadata',
    schema: {
      type: 'object',
      required: ['receipt', 'invoiceId', 'amount'],
      properties: {
        receipt: { type: 'string', format: 'binary', description: 'Receipt image or PDF' },
        invoiceId: { type: 'string', format: 'uuid' },
        amount: { type: 'number', example: 250 },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Receipt uploaded, payment recorded as PENDING_VERIFICATION' })
  uploadBankTransferEndpoint(
    @ClientSession() user: ClientSession,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: MobileBankTransferUploadDto,
  ) {
    if (!file) throw new BadRequestException('receipt file is required');
    return this.bankTransferUpload.execute({
      invoiceId: body.invoiceId,
      clientId: user.id,
      amount: body.amount,
      fileBuffer: file.buffer,
      mimetype: file.mimetype,
      filename: file.originalname,
    });
  }
}
