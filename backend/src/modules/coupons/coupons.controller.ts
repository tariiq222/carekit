import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { RequireFeature } from '../../common/decorators/require-feature.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { CouponsService } from './coupons.service.js';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';
import { ApplyCouponDto } from './dto/apply-coupon.dto.js';
import { ValidateCouponDto } from './dto/validate-coupon.dto.js';
import { CouponFilterDto } from './dto/coupon-filter.dto.js';

@ApiTags('Coupons')
@ApiBearerAuth()
@Controller('coupons')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @CheckPermissions({ module: 'coupons', action: 'view' })
  async findAll(@Query() query: CouponFilterDto) {
    const data = await this.couponsService.findAll(query);
    return { success: true, data };
  }

  @Get(':id')
  @CheckPermissions({ module: 'coupons', action: 'view' })
  async findById(@Param('id', uuidPipe) id: string) {
    const data = await this.couponsService.findById(id);
    return { success: true, data };
  }

  @Post()
  @CheckPermissions({ module: 'coupons', action: 'create' })
  async create(@Body() dto: CreateCouponDto) {
    const data = await this.couponsService.create(dto);
    return { success: true, data };
  }

  @Patch(':id')
  @CheckPermissions({ module: 'coupons', action: 'edit' })
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const data = await this.couponsService.update(id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @CheckPermissions({ module: 'coupons', action: 'delete' })
  async delete(@Param('id', uuidPipe) id: string) {
    const data = await this.couponsService.delete(id);
    return { success: true, data };
  }

  @Post('apply')
  async applyCoupon(@Body() dto: ApplyCouponDto, @Req() req: { user: { id: string } }) {
    const data = await this.couponsService.applyCoupon(dto, req.user.id);
    return { success: true, data };
  }

  @Post('validate')
  @HttpCode(200)
  async validateCode(
    @Body() dto: ValidateCouponDto,
    @Req() req: { user: { id: string } },
  ) {
    const data = await this.couponsService.validateCode(dto, req.user.id);
    return { success: true, data };
  }
}
