import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { EventBusService } from '../../../infrastructure/events';
import { BranchCreatedEvent } from '../events/branch-created.event';
import { CreateBranchDto } from './create-branch.dto';

export type CreateBranchCommand = CreateBranchDto;

@Injectable()
export class CreateBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: CreateBranchCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    const branch = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.branch.findFirst({
          where: { nameAr: dto.nameAr, organizationId },
        });
        if (existing) throw new ConflictException('Branch with this Arabic name already exists');

        if (dto.isMain === true) {
          await tx.branch.updateMany({
            where: { isMain: true, organizationId },
            data: { isMain: false },
          });
        }

        return tx.branch.create({
          data: {
            organizationId,
            nameAr: dto.nameAr,
            nameEn: dto.nameEn,
            phone: dto.phone,
            addressAr: dto.addressAr,
            addressEn: dto.addressEn,
            city: dto.city,
            country: dto.country ?? 'SA',
            latitude: dto.latitude,
            longitude: dto.longitude,
            isActive: dto.isActive,
            isMain: dto.isMain,
            timezone: dto.timezone,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    const event = new BranchCreatedEvent({ branchId: branch.id, organizationId });
    this.eventBus.publish(event.eventName, event.toEnvelope()).catch(() => {});

    return branch;
  }
}
