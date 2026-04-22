import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { JwtStrategy } from './jwt.strategy';
import { ClientJwtStrategy } from './client-jwt.strategy';
import { PasswordService } from './shared/password.service';
import { TokenService } from './shared/token.service';
import { ClientTokenService } from './shared/client-token.service';
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
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { RegisterHandler } from './client-auth/register.handler';
import { ClientLoginHandler } from './client-auth/client-login.handler';
import { ClientRefreshHandler } from './client-auth/client-refresh.handler';
import { ClientLogoutHandler } from './client-auth/client-logout.handler';
import { GetMeHandler } from './client-auth/get-me.handler';
import { ResetPasswordHandler } from './client-auth/reset-password/reset-password.handler';
import { PasswordHistoryService } from './client-auth/shared/password-history.service';
import { ListMembershipsHandler } from './list-memberships/list-memberships.handler';
import { SwitchOrganizationHandler } from './switch-organization/switch-organization.handler';

const handlers = [
  LoginHandler, RefreshTokenHandler, LogoutHandler,
  GetCurrentUserHandler, CreateUserHandler, UpdateUserHandler, ListUsersHandler,
  DeactivateUserHandler, DeleteUserHandler, AssignRoleHandler, RemoveRoleHandler,
  CreateRoleHandler, DeleteRoleHandler, AssignPermissionsHandler, ListRolesHandler,
  ListPermissionsHandler,
  ChangePasswordHandler,
  RequestOtpHandler,
  VerifyOtpHandler,
  RegisterHandler,
  ClientLoginHandler,
  ClientRefreshHandler,
  ClientLogoutHandler,
  GetMeHandler,
  ResetPasswordHandler,
  ListMembershipsHandler,
  SwitchOrganizationHandler,
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
    JwtStrategy,
    ClientJwtStrategy,
    PasswordService,
    PasswordHistoryService,
    TokenService,
    ClientTokenService,
    RedisService,
    CaslAbilityFactory,
    ClientSessionGuard,
    { provide: CAPTCHA_VERIFIER, useFactory: () => { const { createCaptchaVerifier } = require('../comms/contact-messages/captcha.verifier'); return createCaptchaVerifier(); } },
    ...handlers,
    OtpSessionService,
    OtpSessionGuard,
  ],
  exports: [
    CaslAbilityFactory,
    TokenService,
    ClientTokenService,
    RedisService,
    PasswordService,
    ClientSessionGuard,
    RequestOtpHandler,
    VerifyOtpHandler,
    OtpSessionService,
    OtpSessionGuard,
    RegisterHandler,
    ...handlers,
  ],
})
export class IdentityModule {}
