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
import { ChangePasswordHandler } from './users/change-password.handler';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { DashboardIdentityController } from '../../api/dashboard/identity.controller';

const handlers = [
  LoginHandler, RefreshTokenHandler, LogoutHandler,
  GetCurrentUserHandler, CreateUserHandler, UpdateUserHandler, ListUsersHandler,
  DeactivateUserHandler, DeleteUserHandler, AssignRoleHandler, RemoveRoleHandler,
  CreateRoleHandler, DeleteRoleHandler, AssignPermissionsHandler, ListRolesHandler,
  ChangePasswordHandler,
];

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
  providers: [JwtStrategy, PasswordService, TokenService, CaslAbilityFactory, ...handlers],
  exports: [CaslAbilityFactory, TokenService, PasswordService, ...handlers],
})
export class IdentityModule {}
