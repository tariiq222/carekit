# Phase 2: Identity BC + Platform BC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Identity BC (auth, users, roles, permissions) and Platform BC (license, feature flags, problem reports) in parallel — two independent Agent Teams running simultaneously.

**Architecture:** Two fully independent Bounded Contexts with zero imports between them. Identity owns authentication and RBAC. Platform owns license validation and feature gating. Both expose slices via CQRS. The existing guards (`JwtGuard`, `CaslGuard`, `FeatureGuard`) in `common/` are already wired — Identity BC provides the JwtStrategy and the CASL ability factory that back them; Platform BC provides the license-check logic that `FeatureGuard` delegates to.

**Tech Stack:** NestJS 11, Prisma 7 (split schema), `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `@casl/ability ^6`, `bcryptjs`, `class-validator`, `class-transformer`, Redis (token blacklist via `RedisService`), Jest

---

## Prerequisites — install missing packages

Before any task begins, install the packages that are missing from `apps/backend`:

- [ ] **Step 1: Install deps**

```bash
cd apps/backend
npm install bcryptjs class-validator class-transformer
npm install -D @types/bcryptjs
```

Expected: no errors. `package.json` updated.

- [ ] **Step 2: Enable global ValidationPipe**

Open `src/main.ts` — replace with:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(process.env.PORT ?? 5100);
}
bootstrap();
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/package.json apps/backend/package-lock.json apps/backend/src/main.ts
git commit -m "chore(backend): install bcryptjs, class-validator, class-transformer; enable ValidationPipe"
```

---

## AGENT TEAM A — Identity BC (p2)

> Owner: all files under `src/modules/identity/` + `prisma/schema/identity.prisma`
> Runs in parallel with Agent Team B.

---

### Task A1: Identity Prisma schema + migration

**Files:**
- Modify: `prisma/schema/identity.prisma`

- [ ] **Step 1: Write the schema**

Replace `prisma/schema/identity.prisma`:

```prisma
// Identity BC — auth, users, roles, permissions.

enum UserRole {
  SUPER_ADMIN
  ADMIN
  RECEPTIONIST
  ACCOUNTANT
  EMPLOYEE
  CLIENT
}

enum UserGender {
  MALE
  FEMALE
}

model User {
  id           String      @id @default(uuid())
  tenantId     String
  email        String
  passwordHash String
  name         String
  phone        String?
  gender       UserGender?
  avatarUrl    String?
  isActive     Boolean     @default(true)
  role         UserRole    @default(RECEPTIONIST)
  customRoleId String?
  customRole   CustomRole? @relation(fields: [customRoleId], references: [id])
  refreshTokens RefreshToken[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@unique([tenantId, email])
  @@index([tenantId])
}

model RefreshToken {
  id        String    @id @default(uuid())
  tenantId  String
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@index([tenantId])
}

model CustomRole {
  id          String       @id @default(uuid())
  tenantId    String
  name        String
  permissions Permission[]
  users       User[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@unique([tenantId, name])
  @@index([tenantId])
}

model Permission {
  id           String     @id @default(uuid())
  tenantId     String
  customRoleId String
  customRole   CustomRole @relation(fields: [customRoleId], references: [id], onDelete: Cascade)
  action       String
  subject      String
  createdAt    DateTime   @default(now())

  @@unique([customRoleId, action, subject])
  @@index([tenantId])
}
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd apps/backend
npm run prisma:migrate -- --name identity_initial
```

Expected: migration file created in `prisma/migrations/`, client regenerated.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema/identity.prisma prisma/migrations/
git commit -m "feat(identity): Prisma schema — User, RefreshToken, CustomRole, Permission"
```

---

### Task A2: login slice

**Files:**
- Create: `src/modules/identity/login/login.command.ts`
- Create: `src/modules/identity/login/login.dto.ts`
- Create: `src/modules/identity/login/login.handler.ts`
- Create: `src/modules/identity/login/login.handler.spec.ts`
- Create: `src/modules/identity/shared/token.service.ts`
- Create: `src/modules/identity/shared/password.service.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/identity/login/login.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoginHandler } from './login.handler';
import { PasswordService } from '../shared/password.service';
import { TokenService } from '../shared/token.service';
import { PrismaService } from '../../../infrastructure/database';

const mockUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'admin@clinic.sa',
  passwordHash: '$2b$10$hashed',
  name: 'Admin',
  phone: null,
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: 'ADMIN',
  customRoleId: null,
  customRole: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('LoginHandler', () => {
  let handler: LoginHandler;
  let prisma: jest.Mocked<PrismaService>;
  let passwordService: jest.Mocked<PasswordService>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LoginHandler,
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
        { provide: PasswordService, useValue: { verify: jest.fn() } },
        { provide: TokenService, useValue: { issueTokenPair: jest.fn() } },
      ],
    }).compile();

    handler = module.get(LoginHandler);
    prisma = module.get(PrismaService);
    passwordService = module.get(PasswordService);
    tokenService = module.get(TokenService);
  });

  it('returns token pair for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser as never);
    passwordService.verify.mockResolvedValue(true);
    tokenService.issueTokenPair.mockResolvedValue({ accessToken: 'acc', refreshToken: 'ref' });

    const result = await handler.execute({ tenantId: 'tenant-1', email: 'admin@clinic.sa', password: 'secret' });
    expect(result.accessToken).toBe('acc');
    expect(result.refreshToken).toBe('ref');
  });

  it('throws UnauthorizedException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ tenantId: 'tenant-1', email: 'x@y.com', password: 'p' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when password wrong', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser as never);
    passwordService.verify.mockResolvedValue(false);
    await expect(
      handler.execute({ tenantId: 'tenant-1', email: 'admin@clinic.sa', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when user is inactive', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false } as never);
    passwordService.verify.mockResolvedValue(true);
    await expect(
      handler.execute({ tenantId: 'tenant-1', email: 'admin@clinic.sa', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/backend && npx jest src/modules/identity/login/login.handler.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './login.handler'`

- [ ] **Step 3: Create shared services**

Create `src/modules/identity/shared/password.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 10;

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.SALT_ROUNDS);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
```

Create `src/modules/identity/shared/token.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
  customRoleId: string | null;
  permissions: Array<{ action: string; subject: string }>;
  features: string[];
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokenPair(user: {
    id: string;
    tenantId: string;
    email: string;
    role: string;
    customRoleId: string | null;
    customRole: { permissions: Array<{ action: string; subject: string }> } | null;
  }): Promise<TokenPair> {
    const permissions = user.customRole?.permissions ?? [];
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      customRoleId: user.customRoleId,
      permissions,
      features: [],
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
    });

    const rawRefresh = randomUUID();
    const tokenHash = await bcrypt.hash(rawRefresh, 10);
    const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const expiresAt = new Date(Date.now() + this.parseTtlMs(ttl));

    await this.prisma.refreshToken.create({
      data: { tenantId: user.tenantId, userId: user.id, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const n = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return n * multipliers[match[2]];
  }
}
```

- [ ] **Step 4: Create command, DTO, handler**

Create `src/modules/identity/login/login.command.ts`:

```typescript
export interface LoginCommand {
  tenantId: string;
  email: string;
  password: string;
}
```

Create `src/modules/identity/login/login.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  tenantId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
```

Create `src/modules/identity/login/login.handler.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';
import { TokenService, TokenPair } from '../shared/token.service';
import type { LoginCommand } from './login.command';

@Injectable()
export class LoginHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async execute(cmd: LoginCommand): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: cmd.tenantId, email: cmd.email } },
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

    const valid = await this.password.verify(cmd.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.tokens.issueTokenPair(user);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/backend && npx jest src/modules/identity/login/login.handler.spec.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/modules/identity/
git commit -m "feat(identity): login slice — LoginHandler, PasswordService, TokenService"
```

---

### Task A3: refresh-token + logout slices

**Files:**
- Create: `src/modules/identity/refresh-token/refresh-token.command.ts`
- Create: `src/modules/identity/refresh-token/refresh-token.handler.ts`
- Create: `src/modules/identity/refresh-token/refresh-token.handler.spec.ts`
- Create: `src/modules/identity/logout/logout.command.ts`
- Create: `src/modules/identity/logout/logout.handler.ts`
- Create: `src/modules/identity/logout/logout.handler.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/modules/identity/refresh-token/refresh-token.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenHandler } from './refresh-token.handler';
import { TokenService } from '../shared/token.service';
import { PrismaService } from '../../../infrastructure/database';

describe('RefreshTokenHandler', () => {
  let handler: RefreshTokenHandler;
  let prisma: jest.Mocked<PrismaService>;
  let tokenService: jest.Mocked<TokenService>;

  const futureDate = new Date(Date.now() + 86400000);

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RefreshTokenHandler,
        {
          provide: PrismaService,
          useValue: {
            refreshToken: { findMany: jest.fn(), update: jest.fn() },
            user: { findUnique: jest.fn() },
          },
        },
        { provide: TokenService, useValue: { issueTokenPair: jest.fn() } },
      ],
    }).compile();

    handler = module.get(RefreshTokenHandler);
    prisma = module.get(PrismaService);
    tokenService = module.get(TokenService);
  });

  it('issues new token pair when refresh token is valid', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([
      { id: 'rt-1', userId: 'user-1', tokenHash: '$2b$10$abc', expiresAt: futureDate, revokedAt: null, tenantId: 'tenant-1', createdAt: new Date() },
    ] as never);
    jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', email: 'a@b.com', role: 'ADMIN', customRoleId: null, customRole: null, isActive: true } as never);
    prisma.refreshToken.update.mockResolvedValue({} as never);
    tokenService.issueTokenPair.mockResolvedValue({ accessToken: 'new-acc', refreshToken: 'new-ref' });

    const result = await handler.execute({ tenantId: 'tenant-1', userId: 'user-1', rawToken: 'raw' });
    expect(result.accessToken).toBe('new-acc');
  });

  it('throws UnauthorizedException when no valid token found', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([]);
    await expect(
      handler.execute({ tenantId: 'tenant-1', userId: 'user-1', rawToken: 'bad' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

Create `src/modules/identity/logout/logout.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { LogoutHandler } from './logout.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('LogoutHandler', () => {
  let handler: LogoutHandler;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LogoutHandler,
        { provide: PrismaService, useValue: { refreshToken: { updateMany: jest.fn() } } },
      ],
    }).compile();
    handler = module.get(LogoutHandler);
    prisma = module.get(PrismaService);
  });

  it('revokes all refresh tokens for the user', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    await handler.execute({ userId: 'user-1', tenantId: 'tenant-1' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && npx jest src/modules/identity/refresh-token/ src/modules/identity/logout/ --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement refresh-token slice**

Create `src/modules/identity/refresh-token/refresh-token.command.ts`:

```typescript
export interface RefreshTokenCommand {
  tenantId: string;
  userId: string;
  rawToken: string;
}
```

Create `src/modules/identity/refresh-token/refresh-token.handler.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { TokenService, TokenPair } from '../shared/token.service';
import type { RefreshTokenCommand } from './refresh-token.command';

@Injectable()
export class RefreshTokenHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async execute(cmd: RefreshTokenCommand): Promise<TokenPair> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId: cmd.userId, tenantId: cmd.tenantId, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    let matched: (typeof candidates)[0] | undefined;
    for (const c of candidates) {
      if (await bcrypt.compare(cmd.rawToken, c.tokenHash)) { matched = c; break; }
    }

    if (!matched) throw new UnauthorizedException('Invalid or expired refresh token');

    await this.prisma.refreshToken.update({ where: { id: matched.id }, data: { revokedAt: new Date() } });

    const user = await this.prisma.user.findUnique({
      where: { id: cmd.userId },
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    return this.tokens.issueTokenPair(user);
  }
}
```

- [ ] **Step 4: Implement logout slice**

Create `src/modules/identity/logout/logout.command.ts`:

```typescript
export interface LogoutCommand {
  userId: string;
  tenantId: string;
}
```

Create `src/modules/identity/logout/logout.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { LogoutCommand } from './logout.command';

@Injectable()
export class LogoutHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: LogoutCommand): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId: cmd.userId, tenantId: cmd.tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/backend && npx jest src/modules/identity/refresh-token/ src/modules/identity/logout/ --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/identity/refresh-token/ src/modules/identity/logout/
git commit -m "feat(identity): refresh-token + logout slices"
```

---

### Task A4: get-current-user + users CRUD slices

**Files:**
- Create: `src/modules/identity/get-current-user/get-current-user.query.ts`
- Create: `src/modules/identity/get-current-user/get-current-user.handler.ts`
- Create: `src/modules/identity/get-current-user/get-current-user.handler.spec.ts`
- Create: `src/modules/identity/users/create-user.handler.ts`
- Create: `src/modules/identity/users/create-user.dto.ts`
- Create: `src/modules/identity/users/update-user.handler.ts`
- Create: `src/modules/identity/users/list-users.handler.ts`
- Create: `src/modules/identity/users/deactivate-user.handler.ts`
- Create: `src/modules/identity/users/users.handler.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/modules/identity/get-current-user/get-current-user.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetCurrentUserHandler } from './get-current-user.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetCurrentUserHandler', () => {
  let handler: GetCurrentUserHandler;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetCurrentUserHandler,
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
      ],
    }).compile();
    handler = module.get(GetCurrentUserHandler);
    prisma = module.get(PrismaService);
  });

  it('returns user when found', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', tenantId: 'tenant-1' } as never);
    const result = await handler.execute({ userId: 'u1', tenantId: 'tenant-1' });
    expect(result.id).toBe('u1');
  });

  it('throws NotFoundException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'u1', tenantId: 'tenant-1' })).rejects.toThrow(NotFoundException);
  });
});
```

Create `src/modules/identity/users/users.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserHandler } from './create-user.handler';
import { DeactivateUserHandler } from './deactivate-user.handler';
import { ListUsersHandler } from './list-users.handler';
import { PasswordService } from '../shared/password.service';
import { PrismaService } from '../../../infrastructure/database';

describe('Users handlers', () => {
  let createHandler: CreateUserHandler;
  let deactivateHandler: DeactivateUserHandler;
  let listHandler: ListUsersHandler;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateUserHandler,
        DeactivateUserHandler,
        ListUsersHandler,
        { provide: PasswordService, useValue: { hash: jest.fn().mockResolvedValue('hashed') } },
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
          },
        },
      ],
    }).compile();

    createHandler = module.get(CreateUserHandler);
    deactivateHandler = module.get(DeactivateUserHandler);
    listHandler = module.get(ListUsersHandler);
    prisma = module.get(PrismaService);
  });

  describe('CreateUserHandler', () => {
    it('creates user with hashed password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com' } as never);
      const result = await createHandler.execute({ tenantId: 'tenant-1', email: 'a@b.com', password: 'pass123', name: 'Ali', role: 'RECEPTIONIST' as never });
      expect(result.id).toBe('u1');
    });

    it('throws ConflictException when email already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' } as never);
      await expect(
        createHandler.execute({ tenantId: 'tenant-1', email: 'a@b.com', password: 'pass', name: 'Ali', role: 'RECEPTIONIST' as never }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('DeactivateUserHandler', () => {
    it('deactivates user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, tenantId: 'tenant-1' } as never);
      prisma.user.update.mockResolvedValue({ id: 'u1', isActive: false } as never);
      await deactivateHandler.execute({ userId: 'u1', tenantId: 'tenant-1' });
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(deactivateHandler.execute({ userId: 'u1', tenantId: 'tenant-1' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('ListUsersHandler', () => {
    it('returns paginated users', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }] as never);
      prisma.user.count.mockResolvedValue(1);
      const result = await listHandler.execute({ tenantId: 'tenant-1', page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && npx jest src/modules/identity/get-current-user/ src/modules/identity/users/ --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement get-current-user**

Create `src/modules/identity/get-current-user/get-current-user.query.ts`:

```typescript
export interface GetCurrentUserQuery {
  userId: string;
  tenantId: string;
}
```

Create `src/modules/identity/get-current-user/get-current-user.handler.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { GetCurrentUserQuery } from './get-current-user.query';

@Injectable()
export class GetCurrentUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetCurrentUserQuery) {
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
      include: { customRole: { include: { permissions: true } } },
      omit: { passwordHash: true },
    });
    if (!user || user.tenantId !== query.tenantId) throw new NotFoundException('User not found');
    return user;
  }
}
```

- [ ] **Step 4: Implement users CRUD handlers**

Create `src/modules/identity/users/create-user.dto.ts`:

```typescript
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole, UserGender } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  tenantId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  name!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @IsString()
  customRoleId?: string;
}
```

Create `src/modules/identity/users/create-user.handler.ts`:

```typescript
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
```

Create `src/modules/identity/users/update-user.handler.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UserGender, UserRole } from '@prisma/client';

export interface UpdateUserCommand {
  userId: string;
  tenantId: string;
  name?: string;
  phone?: string;
  gender?: UserGender;
  role?: UserRole;
  customRoleId?: string | null;
  avatarUrl?: string;
}

@Injectable()
export class UpdateUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateUserCommand) {
    const user = await this.prisma.user.findUnique({ where: { id: cmd.userId } });
    if (!user || user.tenantId !== cmd.tenantId) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: cmd.userId },
      data: { name: cmd.name, phone: cmd.phone, gender: cmd.gender, role: cmd.role, customRoleId: cmd.customRoleId, avatarUrl: cmd.avatarUrl },
      omit: { passwordHash: true },
    });
  }
}
```

Create `src/modules/identity/users/list-users.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListUsersQuery {
  tenantId: string;
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}

@Injectable()
export class ListUsersHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListUsersQuery) {
    const where = {
      tenantId: query.tenantId,
      isActive: query.isActive,
      ...(query.search
        ? { OR: [{ name: { contains: query.search, mode: 'insensitive' as const } }, { email: { contains: query.search, mode: 'insensitive' as const } }] }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: 'desc' }, omit: { passwordHash: true } }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }
}
```

Create `src/modules/identity/users/deactivate-user.handler.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeactivateUserCommand {
  userId: string;
  tenantId: string;
}

@Injectable()
export class DeactivateUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: DeactivateUserCommand): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: cmd.userId } });
    if (!user || user.tenantId !== cmd.tenantId) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id: cmd.userId }, data: { isActive: false } });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/backend && npx jest src/modules/identity/get-current-user/ src/modules/identity/users/ --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/identity/get-current-user/ src/modules/identity/users/
git commit -m "feat(identity): get-current-user + users CRUD slices"
```

---

### Task A5: create-role + assign-permissions + CaslAbilityFactory

**Files:**
- Create: `src/modules/identity/roles/create-role.handler.ts`
- Create: `src/modules/identity/roles/create-role.dto.ts`
- Create: `src/modules/identity/roles/assign-permissions.handler.ts`
- Create: `src/modules/identity/roles/assign-permissions.dto.ts`
- Create: `src/modules/identity/roles/list-roles.handler.ts`
- Create: `src/modules/identity/roles/roles.handler.spec.ts`
- Create: `src/modules/identity/casl/casl-ability.factory.ts`
- Create: `src/modules/identity/casl/casl-ability.factory.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/modules/identity/casl/casl-ability.factory.spec.ts`:

```typescript
import { CaslAbilityFactory } from './casl-ability.factory';

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  it('grants manage all for SUPER_ADMIN', () => {
    const ability = factory.buildForUser({ role: 'SUPER_ADMIN', customRole: null });
    expect(ability.can('manage', 'all')).toBe(true);
  });

  it('grants specific permissions from custom role', () => {
    const ability = factory.buildForUser({
      role: 'RECEPTIONIST',
      customRole: { permissions: [{ action: 'create', subject: 'Booking' }, { action: 'read', subject: 'Client' }] },
    });
    expect(ability.can('create', 'Booking')).toBe(true);
    expect(ability.can('read', 'Client')).toBe(true);
    expect(ability.can('delete', 'Booking')).toBe(false);
  });

  it('grants read on own domain for EMPLOYEE', () => {
    const ability = factory.buildForUser({ role: 'EMPLOYEE', customRole: null });
    expect(ability.can('read', 'Booking')).toBe(true);
    expect(ability.can('delete', 'Invoice')).toBe(false);
  });

  it('grants full finance access for ACCOUNTANT', () => {
    const ability = factory.buildForUser({ role: 'ACCOUNTANT', customRole: null });
    expect(ability.can('manage', 'Invoice')).toBe(true);
    expect(ability.can('manage', 'Payment')).toBe(true);
  });
});
```

Create `src/modules/identity/roles/roles.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateRoleHandler } from './create-role.handler';
import { AssignPermissionsHandler } from './assign-permissions.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('Roles handlers', () => {
  let createRole: CreateRoleHandler;
  let assignPerms: AssignPermissionsHandler;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateRoleHandler,
        AssignPermissionsHandler,
        {
          provide: PrismaService,
          useValue: {
            customRole: { findUnique: jest.fn(), create: jest.fn() },
            permission: { deleteMany: jest.fn(), createMany: jest.fn() },
          },
        },
      ],
    }).compile();

    createRole = module.get(CreateRoleHandler);
    assignPerms = module.get(AssignPermissionsHandler);
    prisma = module.get(PrismaService);
  });

  it('creates a new custom role', async () => {
    prisma.customRole.findUnique.mockResolvedValue(null);
    prisma.customRole.create.mockResolvedValue({ id: 'role-1', name: 'Senior Receptionist' } as never);
    const result = await createRole.execute({ tenantId: 'tenant-1', name: 'Senior Receptionist' });
    expect(result.id).toBe('role-1');
  });

  it('throws ConflictException for duplicate role name', async () => {
    prisma.customRole.findUnique.mockResolvedValue({ id: 'exists' } as never);
    await expect(createRole.execute({ tenantId: 'tenant-1', name: 'Existing Role' })).rejects.toThrow(ConflictException);
  });

  it('replaces permissions for a role', async () => {
    prisma.permission.deleteMany.mockResolvedValue({ count: 1 });
    prisma.permission.createMany.mockResolvedValue({ count: 2 });
    await assignPerms.execute({
      tenantId: 'tenant-1',
      customRoleId: 'role-1',
      permissions: [{ action: 'create', subject: 'Booking' }, { action: 'read', subject: 'Client' }],
    });
    expect(prisma.permission.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: { customRoleId: 'role-1' } }));
    expect(prisma.permission.createMany).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && npx jest src/modules/identity/casl/ src/modules/identity/roles/ --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement CaslAbilityFactory**

Create `src/modules/identity/casl/casl-ability.factory.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';

export type AppAbility = MongoAbility;

const BUILT_IN: Record<string, Array<{ action: string; subject: string }>> = {
  SUPER_ADMIN: [{ action: 'manage', subject: 'all' }],
  ADMIN: [
    { action: 'manage', subject: 'User' },
    { action: 'manage', subject: 'Booking' },
    { action: 'manage', subject: 'Client' },
    { action: 'manage', subject: 'Employee' },
    { action: 'manage', subject: 'Invoice' },
    { action: 'manage', subject: 'Payment' },
    { action: 'manage', subject: 'Report' },
    { action: 'manage', subject: 'Setting' },
  ],
  RECEPTIONIST: [
    { action: 'manage', subject: 'Booking' },
    { action: 'manage', subject: 'Client' },
    { action: 'read', subject: 'Employee' },
    { action: 'read', subject: 'Invoice' },
  ],
  ACCOUNTANT: [
    { action: 'manage', subject: 'Invoice' },
    { action: 'manage', subject: 'Payment' },
    { action: 'read', subject: 'Booking' },
    { action: 'read', subject: 'Report' },
  ],
  EMPLOYEE: [
    { action: 'read', subject: 'Booking' },
    { action: 'read', subject: 'Client' },
    { action: 'update', subject: 'Booking' },
  ],
  CLIENT: [
    { action: 'read', subject: 'Booking' },
    { action: 'create', subject: 'Booking' },
    { action: 'read', subject: 'Invoice' },
  ],
};

@Injectable()
export class CaslAbilityFactory {
  buildForUser(user: {
    role: string;
    customRole: { permissions: Array<{ action: string; subject: string }> } | null;
  }): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    for (const p of BUILT_IN[user.role] ?? []) can(p.action, p.subject);
    if (user.customRole) for (const p of user.customRole.permissions) can(p.action, p.subject);

    return build();
  }
}
```

- [ ] **Step 4: Implement roles handlers**

Create `src/modules/identity/roles/create-role.dto.ts`:

```typescript
import { IsString, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  tenantId!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}
```

Create `src/modules/identity/roles/create-role.handler.ts`:

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { CreateRoleDto } from './create-role.dto';

@Injectable()
export class CreateRoleHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateRoleDto) {
    const existing = await this.prisma.customRole.findUnique({
      where: { tenantId_name: { tenantId: dto.tenantId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Role "${dto.name}" already exists`);
    return this.prisma.customRole.create({ data: { tenantId: dto.tenantId, name: dto.name }, include: { permissions: true } });
  }
}
```

Create `src/modules/identity/roles/assign-permissions.dto.ts`:

```typescript
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PermissionEntryDto {
  @IsString() action!: string;
  @IsString() subject!: string;
}

export class AssignPermissionsDto {
  @IsString() tenantId!: string;
  @IsString() customRoleId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions!: PermissionEntryDto[];
}
```

Create `src/modules/identity/roles/assign-permissions.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { AssignPermissionsDto } from './assign-permissions.dto';

@Injectable()
export class AssignPermissionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: AssignPermissionsDto): Promise<void> {
    await this.prisma.permission.deleteMany({ where: { customRoleId: dto.customRoleId } });
    await this.prisma.permission.createMany({
      data: dto.permissions.map((p) => ({ tenantId: dto.tenantId, customRoleId: dto.customRoleId, action: p.action, subject: p.subject })),
    });
  }
}
```

Create `src/modules/identity/roles/list-roles.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListRolesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenantId: string) {
    return this.prisma.customRole.findMany({ where: { tenantId }, include: { permissions: true }, orderBy: { createdAt: 'asc' } });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/backend && npx jest src/modules/identity/casl/ src/modules/identity/roles/ --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/identity/casl/ src/modules/identity/roles/
git commit -m "feat(identity): CaslAbilityFactory + create-role + assign-permissions slices"
```

---

### Task A6: JwtStrategy + IdentityModule wiring

**Files:**
- Create: `src/modules/identity/jwt.strategy.ts`
- Create: `src/modules/identity/jwt.strategy.spec.ts`
- Create: `src/modules/identity/identity.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/identity/jwt.strategy.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../infrastructure/database';
import { CaslAbilityFactory } from './casl/casl-ability.factory';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('secret-key') } },
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
        { provide: CaslAbilityFactory, useValue: { buildForUser: jest.fn().mockReturnValue({ rules: [] }) } },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
    prisma = module.get(PrismaService);
  });

  it('returns enriched user object for valid payload', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', tenantId: 'tenant-1', email: 'a@b.com', role: 'ADMIN',
      customRoleId: null, customRole: null, isActive: true,
    } as never);

    const result = await strategy.validate({ sub: 'u1', tenantId: 'tenant-1', email: 'a@b.com', role: 'ADMIN', customRoleId: null, permissions: [], features: [] });
    expect(result.id).toBe('u1');
    expect(result.permissions).toBeDefined();
  });

  it('throws UnauthorizedException when user not found or inactive', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: 'u1', tenantId: 'tenant-1', email: 'a@b.com', role: 'ADMIN', customRoleId: null, permissions: [], features: [] }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/backend && npx jest src/modules/identity/jwt.strategy.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement JwtStrategy**

Create `src/modules/identity/jwt.strategy.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import type { JwtPayload } from './shared/token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly casl: CaslAbilityFactory,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    const ability = this.casl.buildForUser(user);

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      customRoleId: user.customRoleId,
      permissions: ability.rules.map((r) => ({ action: String(r.action), subject: String(r.subject) })),
      features: payload.features ?? [],
    };
  }
}
```

- [ ] **Step 4: Create IdentityModule**

Create `src/modules/identity/identity.module.ts`:

```typescript
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
```

- [ ] **Step 5: Add IdentityModule to AppModule**

Modify `src/app.module.ts`:

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database';
import { MessagingModule } from './infrastructure/messaging.module';
import { StorageModule } from './infrastructure/storage';
import { MailModule } from './infrastructure/mail';
import { TenantMiddleware } from './common/tenant';
import { IdentityModule } from './modules/identity/identity.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    DatabaseModule,
    MessagingModule,
    StorageModule,
    MailModule,
    IdentityModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 6: Run full Identity suite**

```bash
cd apps/backend && npx jest src/modules/identity/ --no-coverage --verbose
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/identity/jwt.strategy.ts src/modules/identity/jwt.strategy.spec.ts src/modules/identity/identity.module.ts src/app.module.ts
git commit -m "feat(identity): JwtStrategy + IdentityModule — p2 complete"
```

---

## AGENT TEAM B — Platform BC (p3)

> Owner: all files under `src/modules/platform/` + `prisma/schema/platform.prisma`
> Runs in parallel with Agent Team A.

---

### Task B1: Platform Prisma schema + migration

**Files:**
- Modify: `prisma/schema/platform.prisma`

- [ ] **Step 1: Write the schema**

Replace `prisma/schema/platform.prisma`:

```prisma
// Platform BC — license validation, feature flags, problem reports, integrations.

enum ProblemReportStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum ProblemReportType {
  BUG
  FEATURE_REQUEST
  OTHER
}

model LicenseCache {
  id            String   @id @default(uuid())
  tenantId      String   @unique
  licenseKey    String
  tier          String
  features      String[]
  expiresAt     DateTime
  lastCheckedAt DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model ProblemReport {
  id          String              @id @default(uuid())
  tenantId    String
  reporterId  String
  type        ProblemReportType
  title       String
  description String
  status      ProblemReportStatus @default(OPEN)
  resolution  String?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  @@index([tenantId])
  @@index([status])
}

model Integration {
  id        String   @id @default(uuid())
  tenantId  String
  provider  String
  config    Json
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, provider])
  @@index([tenantId])
}
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd apps/backend
npm run prisma:migrate -- --name platform_initial
```

Expected: migration created, client regenerated.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema/platform.prisma prisma/migrations/
git commit -m "feat(platform): Prisma schema — LicenseCache, ProblemReport, Integration"
```

---

### Task B2: validate-license + check-feature slices

**Files:**
- Create: `src/modules/platform/license/license.types.ts`
- Create: `src/modules/platform/license/validate-license.service.ts`
- Create: `src/modules/platform/license/validate-license.service.spec.ts`
- Create: `src/modules/platform/license/check-feature.handler.ts`
- Create: `src/modules/platform/license/check-feature.handler.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/modules/platform/license/validate-license.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ValidateLicenseService } from './validate-license.service';
import { PrismaService } from '../../../infrastructure/database';

const futureDate = new Date(Date.now() + 86400000 * 365);

describe('ValidateLicenseService', () => {
  let service: ValidateLicenseService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ValidateLicenseService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => (k === 'LICENSE_SERVER_URL' ? '' : k === 'LICENSE_KEY' ? 'test-key' : null)) },
        },
        { provide: PrismaService, useValue: { licenseCache: { findUnique: jest.fn(), upsert: jest.fn() } } },
      ],
    }).compile();

    service = module.get(ValidateLicenseService);
    prisma = module.get(PrismaService);
  });

  it('returns valid license from cache when not expired', async () => {
    prisma.licenseCache.findUnique.mockResolvedValue({
      tenantId: 'tenant-1', tier: 'Pro', features: ['BOOKINGS', 'AI_CHATBOT'],
      expiresAt: futureDate, lastCheckedAt: new Date(), licenseKey: 'key', id: 'lc-1', createdAt: new Date(), updatedAt: new Date(),
    } as never);

    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Pro');
    expect(result.features).toContain('AI_CHATBOT');
  });

  it('falls back to Basic tier when no cache and no license server', async () => {
    prisma.licenseCache.findUnique.mockResolvedValue(null);
    prisma.licenseCache.upsert.mockResolvedValue({} as never);
    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Basic');
    expect(result.features).toContain('BOOKINGS');
  });
});
```

Create `src/modules/platform/license/check-feature.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { CheckFeatureHandler } from './check-feature.handler';
import { ValidateLicenseService } from './validate-license.service';

describe('CheckFeatureHandler', () => {
  let handler: CheckFeatureHandler;
  let licenseService: jest.Mocked<ValidateLicenseService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CheckFeatureHandler,
        { provide: ValidateLicenseService, useValue: { getActiveLicense: jest.fn() } },
      ],
    }).compile();
    handler = module.get(CheckFeatureHandler);
    licenseService = module.get(ValidateLicenseService);
  });

  it('returns true when feature is in license', async () => {
    licenseService.getActiveLicense.mockResolvedValue({ tier: 'Pro', features: ['BOOKINGS', 'AI_CHATBOT'], expiresAt: new Date(Date.now() + 86400000) });
    const result = await handler.execute({ tenantId: 'tenant-1', feature: 'AI_CHATBOT' });
    expect(result).toBe(true);
  });

  it('returns false when feature not in license', async () => {
    licenseService.getActiveLicense.mockResolvedValue({ tier: 'Basic', features: ['BOOKINGS'], expiresAt: new Date(Date.now() + 86400000) });
    const result = await handler.execute({ tenantId: 'tenant-1', feature: 'AI_CHATBOT' });
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && npx jest src/modules/platform/license/ --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement license types**

Create `src/modules/platform/license/license.types.ts`:

```typescript
export interface LicenseInfo {
  tier: string;
  features: string[];
  expiresAt: Date;
}

export const TIER_FEATURES: Record<string, string[]> = {
  Basic: ['BOOKINGS', 'CLIENTS', 'EMPLOYEES', 'PAYMENTS', 'INVOICES', 'NOTIFICATIONS'],
  Pro: ['BOOKINGS', 'CLIENTS', 'EMPLOYEES', 'PAYMENTS', 'INVOICES', 'NOTIFICATIONS', 'GROUPS', 'WAITLIST', 'INTAKE_FORMS', 'RATINGS', 'REPORTS', 'GIFT_CARDS'],
  Enterprise: ['BOOKINGS', 'CLIENTS', 'EMPLOYEES', 'PAYMENTS', 'INVOICES', 'NOTIFICATIONS', 'GROUPS', 'WAITLIST', 'INTAKE_FORMS', 'RATINGS', 'REPORTS', 'GIFT_CARDS', 'AI_CHATBOT', 'ZATCA', 'CUSTOM_ROLES', 'INTEGRATIONS', 'ACTIVITY_LOG'],
};
```

- [ ] **Step 4: Implement ValidateLicenseService**

Create `src/modules/platform/license/validate-license.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { LicenseInfo, TIER_FEATURES } from './license.types';

const CACHE_TTL_MS = 60 * 60 * 1000;
const BASIC: LicenseInfo = {
  tier: 'Basic',
  features: TIER_FEATURES['Basic'],
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
};

@Injectable()
export class ValidateLicenseService {
  private readonly logger = new Logger(ValidateLicenseService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getActiveLicense(tenantId: string): Promise<LicenseInfo> {
    const cached = await this.prisma.licenseCache.findUnique({ where: { tenantId } });

    const serverUrl = this.config.get<string>('LICENSE_SERVER_URL');

    if (cached) {
      const stale = Date.now() - cached.lastCheckedAt.getTime() > CACHE_TTL_MS;
      if (!stale || !serverUrl) {
        return { tier: cached.tier, features: cached.features, expiresAt: cached.expiresAt };
      }
    }

    if (!serverUrl) {
      this.logger.warn(`No LICENSE_SERVER_URL — using Basic for ${tenantId}`);
      await this.upsertCache(tenantId, BASIC);
      return BASIC;
    }

    try {
      const licenseKey = this.config.get<string>('LICENSE_KEY') ?? '';
      const res = await fetch(`${serverUrl}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, licenseKey }),
      });
      if (!res.ok) throw new Error(`License server ${res.status}`);
      const data = (await res.json()) as { tier: string; features: string[]; expiresAt: string };
      const info: LicenseInfo = { tier: data.tier, features: data.features, expiresAt: new Date(data.expiresAt) };
      await this.upsertCache(tenantId, info);
      return info;
    } catch (err) {
      this.logger.error('License server unreachable', err);
      if (cached) return { tier: cached.tier, features: cached.features, expiresAt: cached.expiresAt };
      return BASIC;
    }
  }

  private async upsertCache(tenantId: string, info: LicenseInfo): Promise<void> {
    const licenseKey = this.config.get<string>('LICENSE_KEY') ?? '';
    await this.prisma.licenseCache.upsert({
      where: { tenantId },
      create: { tenantId, licenseKey, tier: info.tier, features: info.features, expiresAt: info.expiresAt },
      update: { tier: info.tier, features: info.features, expiresAt: info.expiresAt, lastCheckedAt: new Date() },
    });
  }
}
```

- [ ] **Step 5: Implement CheckFeatureHandler**

Create `src/modules/platform/license/check-feature.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ValidateLicenseService } from './validate-license.service';

export interface CheckFeatureQuery {
  tenantId: string;
  feature: string;
}

@Injectable()
export class CheckFeatureHandler {
  constructor(private readonly licenseService: ValidateLicenseService) {}

  async execute(query: CheckFeatureQuery): Promise<boolean> {
    const license = await this.licenseService.getActiveLicense(query.tenantId);
    return license.features.includes(query.feature);
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd apps/backend && npx jest src/modules/platform/license/ --no-coverage
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/platform/license/
git commit -m "feat(platform): validate-license + check-feature slices"
```

---

### Task B3: problem-reports + integrations CRUD slices

**Files:**
- Create: `src/modules/platform/problem-reports/create-problem-report.dto.ts`
- Create: `src/modules/platform/problem-reports/create-problem-report.handler.ts`
- Create: `src/modules/platform/problem-reports/list-problem-reports.handler.ts`
- Create: `src/modules/platform/problem-reports/update-problem-report-status.handler.ts`
- Create: `src/modules/platform/problem-reports/problem-reports.handler.spec.ts`
- Create: `src/modules/platform/integrations/upsert-integration.handler.ts`
- Create: `src/modules/platform/integrations/list-integrations.handler.ts`
- Create: `src/modules/platform/integrations/integrations.handler.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/modules/platform/problem-reports/problem-reports.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { CreateProblemReportHandler } from './create-problem-report.handler';
import { ListProblemReportsHandler } from './list-problem-reports.handler';
import { UpdateProblemReportStatusHandler } from './update-problem-report-status.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ProblemReport handlers', () => {
  let create: CreateProblemReportHandler;
  let list: ListProblemReportsHandler;
  let updateStatus: UpdateProblemReportStatusHandler;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateProblemReportHandler, ListProblemReportsHandler, UpdateProblemReportStatusHandler,
        { provide: PrismaService, useValue: { problemReport: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() } } },
      ],
    }).compile();

    create = module.get(CreateProblemReportHandler);
    list = module.get(ListProblemReportsHandler);
    updateStatus = module.get(UpdateProblemReportStatusHandler);
    prisma = module.get(PrismaService);
  });

  it('creates a problem report', async () => {
    prisma.problemReport.create.mockResolvedValue({ id: 'pr-1' } as never);
    const result = await create.execute({ tenantId: 'tenant-1', reporterId: 'user-1', type: 'BUG' as never, title: 'Bug', description: 'Something broken' });
    expect(result.id).toBe('pr-1');
  });

  it('lists problem reports with pagination', async () => {
    prisma.problemReport.findMany.mockResolvedValue([{ id: 'pr-1' }] as never);
    prisma.problemReport.count.mockResolvedValue(1);
    const result = await list.execute({ tenantId: 'tenant-1', page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('updates problem report status', async () => {
    prisma.problemReport.update.mockResolvedValue({ id: 'pr-1', status: 'RESOLVED' } as never);
    const result = await updateStatus.execute({ id: 'pr-1', tenantId: 'tenant-1', status: 'RESOLVED' as never, resolution: 'Fixed' });
    expect(result.status).toBe('RESOLVED');
  });
});
```

Create `src/modules/platform/integrations/integrations.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { UpsertIntegrationHandler } from './upsert-integration.handler';
import { ListIntegrationsHandler } from './list-integrations.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('Integration handlers', () => {
  let upsert: UpsertIntegrationHandler;
  let list: ListIntegrationsHandler;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UpsertIntegrationHandler, ListIntegrationsHandler,
        { provide: PrismaService, useValue: { integration: { upsert: jest.fn(), findMany: jest.fn() } } },
      ],
    }).compile();

    upsert = module.get(UpsertIntegrationHandler);
    list = module.get(ListIntegrationsHandler);
    prisma = module.get(PrismaService);
  });

  it('upserts integration config', async () => {
    prisma.integration.upsert.mockResolvedValue({ id: 'int-1', provider: 'zoom' } as never);
    const result = await upsert.execute({ tenantId: 'tenant-1', provider: 'zoom', config: { apiKey: 'key' } });
    expect(result.id).toBe('int-1');
  });

  it('lists active integrations for tenant', async () => {
    prisma.integration.findMany.mockResolvedValue([{ id: 'int-1' }] as never);
    const result = await list.execute('tenant-1');
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && npx jest src/modules/platform/problem-reports/ src/modules/platform/integrations/ --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement problem-reports handlers**

Create `src/modules/platform/problem-reports/create-problem-report.dto.ts`:

```typescript
import { IsEnum, IsString, MinLength } from 'class-validator';
import { ProblemReportType } from '@prisma/client';

export class CreateProblemReportDto {
  @IsString() tenantId!: string;
  @IsString() reporterId!: string;
  @IsEnum(ProblemReportType) type!: ProblemReportType;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(10) description!: string;
}
```

Create `src/modules/platform/problem-reports/create-problem-report.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { CreateProblemReportDto } from './create-problem-report.dto';

@Injectable()
export class CreateProblemReportHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateProblemReportDto) {
    return this.prisma.problemReport.create({
      data: { tenantId: dto.tenantId, reporterId: dto.reporterId, type: dto.type, title: dto.title, description: dto.description },
    });
  }
}
```

Create `src/modules/platform/problem-reports/list-problem-reports.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ProblemReportStatus } from '@prisma/client';

export interface ListProblemReportsQuery {
  tenantId: string;
  page: number;
  limit: number;
  status?: ProblemReportStatus;
}

@Injectable()
export class ListProblemReportsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListProblemReportsQuery) {
    const where = { tenantId: query.tenantId, status: query.status };
    const [data, total] = await Promise.all([
      this.prisma.problemReport.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.problemReport.count({ where }),
    ]);
    return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }
}
```

Create `src/modules/platform/problem-reports/update-problem-report-status.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ProblemReportStatus } from '@prisma/client';

export interface UpdateProblemReportStatusCommand {
  id: string;
  tenantId: string;
  status: ProblemReportStatus;
  resolution?: string;
}

@Injectable()
export class UpdateProblemReportStatusHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateProblemReportStatusCommand) {
    return this.prisma.problemReport.update({
      where: { id: cmd.id },
      data: { status: cmd.status, resolution: cmd.resolution },
    });
  }
}
```

- [ ] **Step 4: Implement integrations handlers**

Create `src/modules/platform/integrations/upsert-integration.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UpsertIntegrationCommand {
  tenantId: string;
  provider: string;
  config: Record<string, unknown>;
  isActive?: boolean;
}

@Injectable()
export class UpsertIntegrationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertIntegrationCommand) {
    return this.prisma.integration.upsert({
      where: { tenantId_provider: { tenantId: cmd.tenantId, provider: cmd.provider } },
      create: { tenantId: cmd.tenantId, provider: cmd.provider, config: cmd.config, isActive: cmd.isActive ?? true },
      update: { config: cmd.config, isActive: cmd.isActive ?? true },
    });
  }
}
```

Create `src/modules/platform/integrations/list-integrations.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListIntegrationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenantId: string) {
    return this.prisma.integration.findMany({ where: { tenantId, isActive: true }, orderBy: { provider: 'asc' } });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/backend && npx jest src/modules/platform/problem-reports/ src/modules/platform/integrations/ --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/platform/problem-reports/ src/modules/platform/integrations/
git commit -m "feat(platform): problem-reports + integrations CRUD slices"
```

---

### Task B4: PlatformModule wiring

**Files:**
- Create: `src/modules/platform/platform.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/platform/platform.module.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule } from './platform.module';
import { CheckFeatureHandler } from './license/check-feature.handler';
import { DatabaseModule } from '../../infrastructure/database';

describe('PlatformModule', () => {
  it('resolves CheckFeatureHandler', async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, PlatformModule],
    }).compile();
    expect(module.get(CheckFeatureHandler)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/backend && npx jest src/modules/platform/platform.module.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Create PlatformModule**

Create `src/modules/platform/platform.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { ValidateLicenseService } from './license/validate-license.service';
import { CheckFeatureHandler } from './license/check-feature.handler';
import { CreateProblemReportHandler } from './problem-reports/create-problem-report.handler';
import { ListProblemReportsHandler } from './problem-reports/list-problem-reports.handler';
import { UpdateProblemReportStatusHandler } from './problem-reports/update-problem-report-status.handler';
import { UpsertIntegrationHandler } from './integrations/upsert-integration.handler';
import { ListIntegrationsHandler } from './integrations/list-integrations.handler';

@Module({
  imports: [DatabaseModule],
  providers: [
    ValidateLicenseService, CheckFeatureHandler,
    CreateProblemReportHandler, ListProblemReportsHandler, UpdateProblemReportStatusHandler,
    UpsertIntegrationHandler, ListIntegrationsHandler,
  ],
  exports: [
    ValidateLicenseService, CheckFeatureHandler,
    CreateProblemReportHandler, ListProblemReportsHandler, UpdateProblemReportStatusHandler,
    UpsertIntegrationHandler, ListIntegrationsHandler,
  ],
})
export class PlatformModule {}
```

- [ ] **Step 4: Add PlatformModule to AppModule**

Modify `src/app.module.ts` — add `PlatformModule` to imports:

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database';
import { MessagingModule } from './infrastructure/messaging.module';
import { StorageModule } from './infrastructure/storage';
import { MailModule } from './infrastructure/mail';
import { TenantMiddleware } from './common/tenant';
import { IdentityModule } from './modules/identity/identity.module';
import { PlatformModule } from './modules/platform/platform.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    DatabaseModule,
    MessagingModule,
    StorageModule,
    MailModule,
    IdentityModule,
    PlatformModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 5: Run full Platform suite**

```bash
cd apps/backend && npx jest src/modules/platform/ --no-coverage --verbose
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/platform/platform.module.ts src/modules/platform/platform.module.spec.ts src/app.module.ts
git commit -m "feat(platform): PlatformModule wiring — p3 complete"
```

---

## Final Verification (after both teams complete)

- [ ] **Run full identity + platform suite**

```bash
cd apps/backend && npx jest src/modules/identity/ src/modules/platform/ --no-coverage --verbose
```

Expected: all tests PASS, zero skipped.

- [ ] **TypeScript compile check**

```bash
cd apps/backend && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Update kanban**

In `docs/plan/kanban-state.json`, set all p2 and p3 task statuses to `"done"`.

- [ ] **Final commit**

```bash
git add docs/plan/kanban-state.json
git commit -m "docs(plan): mark p2 (Identity) + p3 (Platform) done in kanban"
```
