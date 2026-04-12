import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeleteCouponCommand { tenantId: string; couponId: string; }

@Injectable()
export class DeleteCouponHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: DeleteCouponCommand): Promise<void> {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: cmd.couponId, tenantId: cmd.tenantId },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (coupon._count.redemptions > 0) {
      throw new BadRequestException('Cannot delete coupon with existing redemptions');
    }
    await this.prisma.coupon.delete({ where: { id: cmd.couponId } });
  }
}
