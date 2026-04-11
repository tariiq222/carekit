import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';
import type { CreateUserDto } from './create-user.dto';

@Injectable()
export class CreateUserHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
  ) {}

  async execute(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: dto.tenantId, email: dto.email } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await this.password.hash(dto.password);
    return this.prisma.user.create({
      data: {
        tenantId: dto.tenantId,
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role,
        phone: dto.phone,
        gender: dto.gender,
        customRoleId: dto.customRoleId,
      },
      omit: { passwordHash: true },
    });
  }
}
