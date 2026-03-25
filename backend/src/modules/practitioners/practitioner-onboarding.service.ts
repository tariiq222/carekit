import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { OtpService } from '../auth/otp.service.js';
import { EmailService } from '../email/email.service.js';
import { OtpType } from '../auth/enums/otp-type.enum.js';
import { OnboardPractitionerDto } from './dto/onboard-practitioner.dto.js';

@Injectable()
export class PractitionerOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
  ) {}

  async onboard(dto: OnboardPractitionerDto): Promise<{ success: boolean; message: string; practitioner: object }> {
    const normalizedEmail = dto.email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A user with this email already exists',
        error: 'USER_EMAIL_EXISTS',
      });
    }

    const practitionerRole = await this.prisma.role.findFirst({
      where: { slug: 'practitioner' },
    });

    if (!practitionerRole) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Role practitioner not found',
        error: 'ROLE_NOT_FOUND',
      });
    }

    let createdUserId: string;
    let createdPractitioner: object;

    // Split nameEn into firstName / lastName
    const nameParts = dto.nameEn.trim().split(/\s+/);
    const firstName = nameParts[0] ?? dto.nameEn;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            firstName,
            lastName,
            passwordHash: null,
            isActive: false,
            avatarUrl: dto.avatarUrl ?? null,
          },
        });

        const practitioner = await tx.practitioner.create({
          data: {
            userId: user.id,
            title: dto.title ?? null,
            nameAr: dto.nameAr,
            specialty: dto.specialty,
            specialtyAr: dto.specialtyAr ?? '',
            bio: dto.bio ?? null,
            bioAr: dto.bioAr ?? null,
            experience: dto.experience ?? 0,
            education: dto.education ?? null,
            educationAr: dto.educationAr ?? null,
            priceClinic: dto.priceClinic ?? 0,
            pricePhone: dto.pricePhone ?? 0,
            priceVideo: dto.priceVideo ?? 0,
            isActive: dto.isActive ?? true,
          },
        });

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: practitionerRole.id,
          },
        });

        return { user, practitioner };
      });

      createdUserId = result.user.id;
      createdPractitioner = result.practitioner;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          statusCode: 409,
          message: 'A user with this email already exists',
          error: 'USER_EMAIL_EXISTS',
        });
      }
      throw err;
    }

    const otpCode = await this.otpService.generateOtp(createdUserId, OtpType.RESET_PASSWORD);
    await this.emailService.sendPractitionerWelcome(normalizedEmail, firstName, otpCode);

    return {
      success: true,
      message: 'Practitioner onboarded successfully. Welcome email sent.',
      practitioner: createdPractitioner,
    };
  }
}
