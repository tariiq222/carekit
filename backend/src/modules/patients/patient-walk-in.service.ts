import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { SALT_ROUNDS } from '../../config/constants.js';
import { CreateWalkInPatientDto } from './dto/create-walk-in-patient.dto.js';
import { ClaimAccountDto } from './dto/claim-account.dto.js';

@Injectable()
export class PatientWalkInService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * تسجيل مريض walk-in من الاستقبال (اسم + جوال فقط، بدون ايميل)
   * - إذا وُجد حساب WALK_IN بنفس الجوال → أرجع الموجود (idempotent)
   * - إذا وُجد حساب FULL بنفس الجوال → ConflictException مع userId
   */
  async createWalkIn(dto: CreateWalkInPatientDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true, firstName: true, lastName: true, phone: true, accountType: true },
    });

    if (existing) {
      if (existing.accountType === AccountType.WALK_IN) {
        return { ...existing, isExisting: true };
      }
      throw new ConflictException({
        statusCode: 409,
        message: 'A patient with this phone number already has a full account',
        error: 'PATIENT_PHONE_EXISTS',
        userId: existing.id,
      });
    }

    const patientRole = await this.prisma.role.findFirst({
      where: { slug: 'patient', isDefault: true },
    });

    const internalEmail = `walkin_${randomUUID()}@internal.carekit`;

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: internalEmail,
          passwordHash: null,
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          phone: dto.phone,
          gender: dto.gender,
          accountType: AccountType.WALK_IN,
        },
      });

      if (patientRole) {
        await tx.userRole.create({
          data: { userId: created.id, roleId: patientRole.id },
        });
      }

      await tx.patientProfile.create({
        data: {
          userId: created.id,
          nationalId:         dto.nationalId,
          nationality:        dto.nationality,
          dateOfBirth:        dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          emergencyName:      dto.emergencyName,
          emergencyPhone:     dto.emergencyPhone,
          bloodType:          dto.bloodType,
          allergies:          dto.allergies,
          chronicConditions:  dto.chronicConditions,
        },
      });

      return created;
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      accountType: user.accountType,
      createdAt: user.createdAt,
      isExisting: false,
    };
  }

  /**
   * تفعيل حساب walk-in من التطبيق (ربط ايميل + كلمة مرور بالحساب الموجود)
   * يستخدم رقم الجوال للتحقق من الهوية
   */
  async claimAccount(dto: ClaimAccountDto) {
    const walkInUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true, accountType: true, email: true },
    });

    if (!walkInUser || walkInUser.accountType !== AccountType.WALK_IN) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'No walk-in account found with this phone number',
        error: 'WALK_IN_NOT_FOUND',
      });
    }

    // تحقق أن الإيميل الجديد غير مستخدم
    const emailTaken = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (emailTaken) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A user with this email already exists',
        error: 'USER_EMAIL_EXISTS',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const updated = await this.prisma.user.update({
      where: { id: walkInUser.id },
      data: {
        email: dto.email,
        passwordHash,
        accountType: AccountType.FULL,
        claimedAt: new Date(),
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        accountType: true,
        claimedAt: true,
      },
    });

    return updated;
  }

  /**
   * فحص داخلي: هل يوجد حساب WALK_IN بهذا الجوال؟
   * يُستخدم من AuthService.register() للـ auto-claim
   */
  async findWalkInByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, accountType: true },
    });
  }
}
