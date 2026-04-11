import { Module } from '@nestjs/common';
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
import { CreateRoleHandler } from './roles/create-role.handler';
import { AssignPermissionsHandler } from './roles/assign-permissions.handler';
import { ListRolesHandler } from './roles/list-roles.handler';
import { CaslAbilityFactory } from './casl/casl-ability.factory';

const handlers = [
  LoginHandler, RefreshTokenHandler, LogoutHandler,
  GetCurrentUserHandler, CreateUserHandler, UpdateUserHandler, ListUsersHandler, DeactivateUserHandler,
  CreateRoleHandler, AssignPermissionsHandler, ListRolesHandler,
];

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  providers: [JwtStrategy, PasswordService, TokenService, CaslAbilityFactory, ...handlers],
  exports: [CaslAbilityFactory, TokenService, PasswordService, ...handlers],
})
export class IdentityModule {}
