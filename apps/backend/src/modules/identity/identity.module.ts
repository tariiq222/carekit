import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../../infrastructure/database';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './shared/password.service';
import { TokenService } from './shared/token.service';
import { LoginHandler } from './login/login.handler';
import { RefreshTokenHandler } from './refresh-token/refresh-token.handler';
import { LogoutHandler } from './logout/logout.handler';
import { GetCurrentUserHandler } from './get-current-user/get-current-user.handler';
import { CreateUserHandler } from './users/create-user.handler';
import { UpdateUserHandler } from './users/update-user.handler';
import { ListUsersHandler } from './users/list-users.handler';
import { DeactivateUserHandler } from './users/deactivate-user.handler';
import { DeleteUserHandler } from './users/delete-user.handler';
import { AssignRoleHandler } from './users/assign-role.handler';
import { RemoveRoleHandler } from './users/remove-role.handler';
import { CreateRoleHandler } from './roles/create-role.handler';
import { DeleteRoleHandler } from './roles/delete-role.handler';
import { AssignPermissionsHandler } from './roles/assign-permissions.handler';
import { ListRolesHandler } from './roles/list-roles.handler';
import { ListPermissionsHandler } from './roles/list-permissions.handler';
import { ChangePasswordHandler } from './users/change-password.handler';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { DashboardIdentityController } from '../../api/dashboard/identity.controller';
import { RequestOtpHandler } from './otp/request-otp.handler';
import { VerifyOtpHandler } from './otp/verify-otp.handler';
import { OtpSessionService } from './otp/otp-session.service';
import { OtpSessionGuard } from './otp/otp-session.guard';
import { NotificationChannelModule } from '../comms/notification-channel/notification-channel.module';
import { CAPTCHA_VERIFIER } from '../comms/contact-messages/captcha.verifier';

const handlers = [
  LoginHandler, RefreshTokenHandler, LogoutHandler,
  GetCurrentUserHandler, CreateUserHandler, UpdateUserHandler, ListUsersHandler,
  DeactivateUserHandler, DeleteUserHandler, AssignRoleHandler, RemoveRoleHandler,
  CreateRoleHandler, DeleteRoleHandler, AssignPermissionsHandler, ListRolesHandler,
  ListPermissionsHandler,
  ChangePasswordHandler,
  RequestOtpHandler,
  VerifyOtpHandler,
];

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    NotificationChannelModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_ACCESS_TTL') ?? '15m') as `${number}${'s'|'m'|'h'|'d'}` },
      }),
    }),
  ],
  controllers: [DashboardIdentityController],
  providers: [
    JwtStrategy, PasswordService, TokenService, CaslAbilityFactory,
    { provide: CAPTCHA_VERIFIER, useFactory: () => { const { createCaptchaVerifier } = require('../comms/contact-messages/captcha.verifier'); return createCaptchaVerifier(); } },
    ...handlers,
    OtpSessionService,
    OtpSessionGuard,
  ],
  exports: [CaslAbilityFactory, TokenService, PasswordService, RequestOtpHandler, VerifyOtpHandler, OtpSessionService, OtpSessionGuard, ...handlers],
})
export class IdentityModule {}
