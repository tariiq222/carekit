import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AuthCacheService } from './auth-cache.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { TokenService } from './token.service.js';
import { OtpService } from './otp.service.js';
import { CookieService } from './cookie.service.js';
import { EmailModule } from '../email/email.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { ActivityLogModule } from '../activity-log/activity-log.module.js';
import { OtpThrottleRedisService } from '../../common/services/otp-throttle-redis.service.js';
import { EmailThrottleGuard } from '../../common/guards/email-throttle.guard.js';
import { PermissionCacheService } from './permission-cache.service.js';
import { ACCESS_TOKEN_EXPIRY } from '../../config/constants.js';

@Module({
  imports: [
    EmailModule,
    PatientsModule,
    ActivityLogModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: ACCESS_TOKEN_EXPIRY,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCacheService,
    TokenService,
    OtpService,
    CookieService,
    JwtStrategy,
    OtpThrottleRedisService,
    EmailThrottleGuard,
    PermissionCacheService,
  ],
  exports: [
    AuthService,
    AuthCacheService,
    TokenService,
    OtpService,
    CookieService,
    JwtStrategy,
    PassportModule,
    PermissionCacheService,
  ],
})
export class AuthModule {}
