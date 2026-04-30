# Backend Unit Test Coverage to 90% — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise backend unit test coverage from 58% to 90%+ by adding controller delegation tests for all 14 untested controllers and a processor test for tasks.processor.ts.

**Architecture:** Each controller test follows the existing "thin delegation" pattern (see `test/unit/bookings/bookings.controller.spec.ts`): mock all injected services, override guards, verify each method delegates correctly. No business logic testing — that's the service layer's job.

**Tech Stack:** Jest, ts-jest, @nestjs/testing, jest.fn() mocks

**Current state:** 58.55% statements / 52.6% functions. 10 controllers at 0%, 3 clinic controllers at 0%, chatbot controller untested, tasks.processor at 0%.

**Pattern reference:** `test/unit/bookings/bookings.controller.spec.ts` (312 lines)

---

## File Structure

All new files go in `backend/test/unit/<module>/`:

| # | File to Create | Covers |
|---|----------------|--------|
| 1 | `test/unit/specialties/specialties.controller.spec.ts` | 5 methods |
| 2 | `test/unit/email-templates/email-templates.controller.spec.ts` | 4 methods |
| 3 | `test/unit/whitelabel/whitelabel.controller.spec.ts` | 6 methods |
| 4 | `test/unit/roles/roles.controller.spec.ts` | 6 methods |
| 5 | `test/unit/coupons/coupons.controller.spec.ts` | 7 methods |
| 6 | `test/unit/gift-cards/gift-cards.controller.spec.ts` | 7 methods |
| 7 | `test/unit/intake-forms/intake-forms.controller.spec.ts` | 8 methods |
| 8 | `test/unit/notifications/notifications.controller.spec.ts` | 6 methods |
| 9 | `test/unit/users/users.controller.spec.ts` | 9 methods |
| 10 | `test/unit/services/services.controller.spec.ts` | 18 methods |
| 11 | `test/unit/clinic/clinic-controllers.spec.ts` | 10 methods (3 controllers) |
| 12 | `test/unit/chatbot/chatbot.controller.spec.ts` | 7 methods |
| 13 | `test/unit/tasks/tasks.processor.spec.ts` | 14 job types + onModuleInit |

---

### Task 1: Specialties Controller Tests

**Files:**
- Create: `backend/test/unit/specialties/specialties.controller.spec.ts`
- Covers: `backend/src/modules/specialties/specialties.controller.ts` (66 lines, 5 methods)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { SpecialtiesController } from '../../../src/modules/specialties/specialties.controller.js';
import { SpecialtiesService } from '../../../src/modules/specialties/specialties.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('SpecialtiesController', () => {
  let controller: SpecialtiesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpecialtiesController],
      providers: [{ provide: SpecialtiesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SpecialtiesController>(SpecialtiesController);
  });

  describe('findAll', () => {
    it('should delegate to service.findAll', async () => {
      const data = [{ id: 's1', nameAr: 'طب عام' }];
      mockService.findAll.mockResolvedValue(data);
      expect(await controller.findAll()).toEqual(data);
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should delegate to service.findOne with id', async () => {
      const item = { id: 's1', nameAr: 'طب عام' };
      mockService.findOne.mockResolvedValue(item);
      expect(await controller.findOne('s1')).toEqual(item);
      expect(mockService.findOne).toHaveBeenCalledWith('s1');
    });
  });

  describe('create', () => {
    it('should delegate to service.create with dto', async () => {
      const dto = { nameAr: 'أسنان', nameEn: 'Dental' } as any;
      const created = { id: 's2', ...dto };
      mockService.create.mockResolvedValue(created);
      expect(await controller.create(dto)).toEqual(created);
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should delegate to service.update with id and dto', async () => {
      const dto = { nameAr: 'أسنان محدث' } as any;
      const updated = { id: 's1', ...dto };
      mockService.update.mockResolvedValue(updated);
      expect(await controller.update('s1', dto)).toEqual(updated);
      expect(mockService.update).toHaveBeenCalledWith('s1', dto);
    });
  });

  describe('delete', () => {
    it('should delegate to service.delete with id', async () => {
      mockService.delete.mockResolvedValue({ deleted: true });
      expect(await controller.delete('s1')).toEqual({ deleted: true });
      expect(mockService.delete).toHaveBeenCalledWith('s1');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/specialties/specialties.controller.spec.ts --verbose`
Expected: 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/specialties/specialties.controller.spec.ts
git commit -m "test(specialties): add controller delegation tests"
```

---

### Task 2: Email Templates Controller Tests

**Files:**
- Create: `backend/test/unit/email-templates/email-templates.controller.spec.ts`
- Covers: `backend/src/modules/email-templates/email-templates.controller.ts` (55 lines, 4 methods)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EmailTemplatesController } from '../../../src/modules/email-templates/email-templates.controller.js';
import { EmailTemplatesService } from '../../../src/modules/email-templates/email-templates.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  findBySlug: jest.fn(),
  update: jest.fn(),
  preview: jest.fn(),
};

describe('EmailTemplatesController', () => {
  let controller: EmailTemplatesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailTemplatesController],
      providers: [{ provide: EmailTemplatesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EmailTemplatesController>(EmailTemplatesController);
  });

  describe('findAll', () => {
    it('should delegate to service.findAll', async () => {
      const templates = [{ id: 't1', slug: 'welcome' }];
      mockService.findAll.mockResolvedValue(templates);
      expect(await controller.findAll()).toEqual(templates);
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('should delegate to service.findBySlug', async () => {
      const template = { id: 't1', slug: 'welcome', bodyHtml: '<p>Hi</p>' };
      mockService.findBySlug.mockResolvedValue(template);
      expect(await controller.findBySlug('welcome')).toEqual(template);
      expect(mockService.findBySlug).toHaveBeenCalledWith('welcome');
    });
  });

  describe('update', () => {
    it('should delegate to service.update with id and dto', async () => {
      const dto = { subject: 'Updated Subject' } as any;
      const updated = { id: 't1', ...dto };
      mockService.update.mockResolvedValue(updated);
      expect(await controller.update('t1', dto)).toEqual(updated);
      expect(mockService.update).toHaveBeenCalledWith('t1', dto);
    });
  });

  describe('preview', () => {
    it('should delegate to service.preview with slug, context, and lang', async () => {
      const dto = { context: { name: 'Ahmed' }, lang: 'ar' } as any;
      const html = '<p>مرحبا Ahmed</p>';
      mockService.preview.mockResolvedValue(html);
      expect(await controller.preview('welcome', dto)).toEqual(html);
      expect(mockService.preview).toHaveBeenCalledWith('welcome', { name: 'Ahmed' }, 'ar');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/email-templates/email-templates.controller.spec.ts --verbose`
Expected: 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/email-templates/email-templates.controller.spec.ts
git commit -m "test(email-templates): add controller delegation tests"
```

---

### Task 3: Whitelabel Controller Tests

**Files:**
- Create: `backend/test/unit/whitelabel/whitelabel.controller.spec.ts`
- Covers: `backend/src/modules/whitelabel/whitelabel.controller.ts` (87 lines, 6 methods)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WhitelabelController } from '../../../src/modules/whitelabel/whitelabel.controller.js';
import { WhitelabelService } from '../../../src/modules/whitelabel/whitelabel.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  getPublicBranding: jest.fn(),
  getConfig: jest.fn(),
  getConfigMap: jest.fn(),
  updateConfig: jest.fn(),
  getConfigByKey: jest.fn(),
  deleteConfig: jest.fn(),
};

describe('WhitelabelController', () => {
  let controller: WhitelabelController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhitelabelController],
      providers: [{ provide: WhitelabelService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WhitelabelController>(WhitelabelController);
  });

  describe('getPublicBranding', () => {
    it('should delegate to service.getPublicBranding', async () => {
      const branding = { logo: 'url', primaryColor: '#354FD8' };
      mockService.getPublicBranding.mockResolvedValue(branding);
      expect(await controller.getPublicBranding()).toEqual(branding);
    });
  });

  describe('getConfig', () => {
    it('should delegate to service.getConfig', async () => {
      const config = [{ key: 'logo', value: 'url' }];
      mockService.getConfig.mockResolvedValue(config);
      expect(await controller.getConfig()).toEqual(config);
    });
  });

  describe('getConfigMap', () => {
    it('should delegate to service.getConfigMap', async () => {
      const map = { logo: 'url', name: 'Deqah' };
      mockService.getConfigMap.mockResolvedValue(map);
      expect(await controller.getConfigMap()).toEqual(map);
    });
  });

  describe('updateConfig', () => {
    it('should delegate to service.updateConfig with dto', async () => {
      const dto = { items: [{ key: 'logo', value: 'new-url' }] } as any;
      const result = { updated: 1 };
      mockService.updateConfig.mockResolvedValue(result);
      expect(await controller.updateConfig(dto)).toEqual(result);
      expect(mockService.updateConfig).toHaveBeenCalledWith(dto);
    });
  });

  describe('getConfigByKey', () => {
    it('should delegate to service.getConfigByKey', async () => {
      const entry = { key: 'logo', value: 'url' };
      mockService.getConfigByKey.mockResolvedValue(entry);
      expect(await controller.getConfigByKey('logo')).toEqual(entry);
      expect(mockService.getConfigByKey).toHaveBeenCalledWith('logo');
    });
  });

  describe('deleteConfig', () => {
    it('should delegate to service.deleteConfig', async () => {
      mockService.deleteConfig.mockResolvedValue({ deleted: true });
      expect(await controller.deleteConfig('logo')).toEqual({ deleted: true });
      expect(mockService.deleteConfig).toHaveBeenCalledWith('logo');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/whitelabel/whitelabel.controller.spec.ts --verbose`
Expected: 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/whitelabel/whitelabel.controller.spec.ts
git commit -m "test(whitelabel): add controller delegation tests"
```

---

### Task 4: Roles Controller Tests

**Files:**
- Create: `backend/test/unit/roles/roles.controller.spec.ts`
- Covers: `backend/src/modules/roles/roles.controller.ts` (113 lines, 6 methods — includes response mapping logic in findAll/create)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from '../../../src/modules/roles/roles.controller.js';
import { RolesService } from '../../../src/modules/roles/roles.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  assignPermission: jest.fn(),
  removePermission: jest.fn(),
};

const mockRole = {
  id: 'r1',
  name: 'Receptionist',
  slug: 'receptionist',
  description: 'Front desk',
  isDefault: false,
  isSystem: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  rolePermissions: [
    {
      permission: { id: 'p1', module: 'bookings', action: 'view' },
    },
  ],
};

describe('RolesController', () => {
  let controller: RolesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [{ provide: RolesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RolesController>(RolesController);
  });

  describe('findAll', () => {
    it('should map rolePermissions to flat permissions array', async () => {
      mockService.findAll.mockResolvedValue([mockRole]);

      const result = await controller.findAll();

      expect(result).toEqual([
        {
          id: 'r1',
          name: 'Receptionist',
          slug: 'receptionist',
          description: 'Front desk',
          isDefault: false,
          isSystem: false,
          createdAt: mockRole.createdAt,
          updatedAt: mockRole.updatedAt,
          permissions: [{ id: 'p1', module: 'bookings', action: 'view' }],
        },
      ]);
    });
  });

  describe('create', () => {
    it('should map response with permissions', async () => {
      const dto = { name: 'Accountant' } as any;
      mockService.create.mockResolvedValue(mockRole);

      const result = await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith(dto);
      expect(result.permissions).toEqual([
        { id: 'p1', module: 'bookings', action: 'view' },
      ]);
    });
  });

  describe('delete', () => {
    it('should delegate to service.delete', async () => {
      mockService.delete.mockResolvedValue({ deleted: true });
      expect(await controller.delete('r1')).toEqual({ deleted: true });
      expect(mockService.delete).toHaveBeenCalledWith('r1');
    });
  });

  describe('assignPermission', () => {
    it('should delegate to service.assignPermission', async () => {
      const dto = { module: 'bookings', action: 'create' } as any;
      mockService.assignPermission.mockResolvedValue({ assigned: true });

      const result = await controller.assignPermission('r1', dto);

      expect(mockService.assignPermission).toHaveBeenCalledWith('r1', 'bookings', 'create');
      expect(result).toEqual({ assigned: true });
    });
  });

  describe('removePermissionPost', () => {
    it('should delegate to service.removePermission (proxy-safe POST)', async () => {
      const dto = { module: 'bookings', action: 'create' } as any;
      mockService.removePermission.mockResolvedValue({ removed: true });

      const result = await controller.removePermissionPost('r1', dto);

      expect(mockService.removePermission).toHaveBeenCalledWith('r1', 'bookings', 'create');
      expect(result).toEqual({ removed: true });
    });
  });

  describe('removePermission', () => {
    it('should delegate to service.removePermission (deprecated DELETE)', async () => {
      const dto = { module: 'bookings', action: 'view' } as any;
      mockService.removePermission.mockResolvedValue({ removed: true });

      const result = await controller.removePermission('r1', dto);

      expect(mockService.removePermission).toHaveBeenCalledWith('r1', 'bookings', 'view');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/roles/roles.controller.spec.ts --verbose`
Expected: 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/roles/roles.controller.spec.ts
git commit -m "test(roles): add controller delegation tests"
```

---

### Task 5: Coupons Controller Tests

**Files:**
- Create: `backend/test/unit/coupons/coupons.controller.spec.ts`
- Covers: `backend/src/modules/coupons/coupons.controller.ts` (86 lines, 7 methods)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CouponsController } from '../../../src/modules/coupons/coupons.controller.js';
import { CouponsService } from '../../../src/modules/coupons/coupons.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  applyCoupon: jest.fn(),
  validateCode: jest.fn(),
};

describe('CouponsController', () => {
  let controller: CouponsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponsController],
      providers: [{ provide: CouponsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CouponsController>(CouponsController);
  });

  describe('findAll', () => {
    it('should wrap service result in success envelope', async () => {
      const coupons = [{ id: 'c1', code: 'SAVE10' }];
      mockService.findAll.mockResolvedValue(coupons);
      const query = { page: '1' } as any;

      const result = await controller.findAll(query);

      expect(result).toEqual({ success: true, data: coupons });
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findById', () => {
    it('should wrap service result in success envelope', async () => {
      const coupon = { id: 'c1', code: 'SAVE10' };
      mockService.findById.mockResolvedValue(coupon);

      const result = await controller.findById('c1');

      expect(result).toEqual({ success: true, data: coupon });
      expect(mockService.findById).toHaveBeenCalledWith('c1');
    });
  });

  describe('create', () => {
    it('should delegate and wrap result', async () => {
      const dto = { code: 'NEW20', discountPercent: 20 } as any;
      const created = { id: 'c2', ...dto };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(result).toEqual({ success: true, data: created });
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should delegate with id and dto', async () => {
      const dto = { discountPercent: 25 } as any;
      const updated = { id: 'c1', discountPercent: 25 };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('c1', dto);

      expect(result).toEqual({ success: true, data: updated });
      expect(mockService.update).toHaveBeenCalledWith('c1', dto);
    });
  });

  describe('delete', () => {
    it('should delegate and wrap result', async () => {
      mockService.delete.mockResolvedValue({ id: 'c1' });

      const result = await controller.delete('c1');

      expect(result).toEqual({ success: true, data: { id: 'c1' } });
      expect(mockService.delete).toHaveBeenCalledWith('c1');
    });
  });

  describe('applyCoupon', () => {
    it('should pass dto and user id from request', async () => {
      const dto = { code: 'SAVE10', bookingId: 'bk-1' } as any;
      const req = { user: { id: 'user-1' } };
      const applied = { discount: 10 };
      mockService.applyCoupon.mockResolvedValue(applied);

      const result = await controller.applyCoupon(dto, req);

      expect(result).toEqual({ success: true, data: applied });
      expect(mockService.applyCoupon).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('validateCode', () => {
    it('should pass dto and user id from request', async () => {
      const dto = { code: 'SAVE10' } as any;
      const req = { user: { id: 'user-1' } };
      const validation = { valid: true, discount: 10 };
      mockService.validateCode.mockResolvedValue(validation);

      const result = await controller.validateCode(dto, req);

      expect(result).toEqual({ success: true, data: validation });
      expect(mockService.validateCode).toHaveBeenCalledWith(dto, 'user-1');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/coupons/coupons.controller.spec.ts --verbose`
Expected: 7 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/coupons/coupons.controller.spec.ts
git commit -m "test(coupons): add controller delegation tests"
```

---

### Task 6: Gift Cards Controller Tests

**Files:**
- Create: `backend/test/unit/gift-cards/gift-cards.controller.spec.ts`
- Covers: `backend/src/modules/gift-cards/gift-cards.controller.ts` (84 lines, 7 methods)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GiftCardsController } from '../../../src/modules/gift-cards/gift-cards.controller.js';
import { GiftCardsService } from '../../../src/modules/gift-cards/gift-cards.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
  checkBalance: jest.fn(),
  addCredit: jest.fn(),
};

describe('GiftCardsController', () => {
  let controller: GiftCardsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GiftCardsController],
      providers: [{ provide: GiftCardsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GiftCardsController>(GiftCardsController);
  });

  describe('findAll', () => {
    it('should wrap result in success envelope', async () => {
      const cards = [{ id: 'gc1', code: 'GIFT-001' }];
      mockService.findAll.mockResolvedValue(cards);
      const query = {} as any;

      expect(await controller.findAll(query)).toEqual({ success: true, data: cards });
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findById', () => {
    it('should delegate with id', async () => {
      const card = { id: 'gc1', balance: 100 };
      mockService.findById.mockResolvedValue(card);

      expect(await controller.findById('gc1')).toEqual({ success: true, data: card });
    });
  });

  describe('create', () => {
    it('should delegate with dto', async () => {
      const dto = { initialBalance: 200 } as any;
      const created = { id: 'gc2', balance: 200 };
      mockService.create.mockResolvedValue(created);

      expect(await controller.create(dto)).toEqual({ success: true, data: created });
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should delegate with id and dto', async () => {
      const dto = { isActive: false } as any;
      const updated = { id: 'gc1', isActive: false };
      mockService.update.mockResolvedValue(updated);

      expect(await controller.update('gc1', dto)).toEqual({ success: true, data: updated });
      expect(mockService.update).toHaveBeenCalledWith('gc1', dto);
    });
  });

  describe('deactivate', () => {
    it('should delegate with id', async () => {
      const result = { id: 'gc1', isActive: false };
      mockService.deactivate.mockResolvedValue(result);

      expect(await controller.deactivate('gc1')).toEqual({ success: true, data: result });
      expect(mockService.deactivate).toHaveBeenCalledWith('gc1');
    });
  });

  describe('checkBalance', () => {
    it('should pass code from dto', async () => {
      const dto = { code: 'GIFT-001' } as any;
      const balance = { balance: 150, currency: 'SAR' };
      mockService.checkBalance.mockResolvedValue(balance);

      expect(await controller.checkBalance(dto)).toEqual({ success: true, data: balance });
      expect(mockService.checkBalance).toHaveBeenCalledWith('GIFT-001');
    });
  });

  describe('addCredit', () => {
    it('should delegate with id and dto', async () => {
      const dto = { amount: 50 } as any;
      const result = { id: 'gc1', balance: 250 };
      mockService.addCredit.mockResolvedValue(result);

      expect(await controller.addCredit('gc1', dto)).toEqual({ success: true, data: result });
      expect(mockService.addCredit).toHaveBeenCalledWith('gc1', dto);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/gift-cards/gift-cards.controller.spec.ts --verbose`
Expected: 7 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/gift-cards/gift-cards.controller.spec.ts
git commit -m "test(gift-cards): add controller delegation tests"
```

---

### Task 7: Intake Forms Controller Tests

**Files:**
- Create: `backend/test/unit/intake-forms/intake-forms.controller.spec.ts`
- Covers: `backend/src/modules/intake-forms/intake-forms.controller.ts` (107 lines, 8 methods)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { IntakeFormsController } from '../../../src/modules/intake-forms/intake-forms.controller.js';
import { IntakeFormsService } from '../../../src/modules/intake-forms/intake-forms.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  listForms: jest.fn(),
  getForm: jest.fn(),
  createForm: jest.fn(),
  updateForm: jest.fn(),
  deleteForm: jest.fn(),
  setFields: jest.fn(),
  submitResponse: jest.fn(),
  getResponseByBooking: jest.fn(),
};

describe('IntakeFormsController', () => {
  let controller: IntakeFormsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntakeFormsController],
      providers: [{ provide: IntakeFormsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<IntakeFormsController>(IntakeFormsController);
  });

  describe('listForms', () => {
    it('should delegate to service.listForms with query', async () => {
      const forms = [{ id: 'f1', title: 'Pre-visit' }];
      const query = { page: '1' } as any;
      mockService.listForms.mockResolvedValue(forms);

      expect(await controller.listForms(query)).toEqual(forms);
      expect(mockService.listForms).toHaveBeenCalledWith(query);
    });
  });

  describe('getForm', () => {
    it('should delegate with formId', async () => {
      const form = { id: 'f1', fields: [] };
      mockService.getForm.mockResolvedValue(form);

      expect(await controller.getForm('f1')).toEqual(form);
      expect(mockService.getForm).toHaveBeenCalledWith('f1');
    });
  });

  describe('createForm', () => {
    it('should delegate with dto', async () => {
      const dto = { title: 'New Form' } as any;
      const created = { id: 'f2', title: 'New Form' };
      mockService.createForm.mockResolvedValue(created);

      expect(await controller.createForm(dto)).toEqual(created);
      expect(mockService.createForm).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateForm', () => {
    it('should delegate with formId and dto', async () => {
      const dto = { title: 'Updated' } as any;
      const updated = { id: 'f1', title: 'Updated' };
      mockService.updateForm.mockResolvedValue(updated);

      expect(await controller.updateForm('f1', dto)).toEqual(updated);
      expect(mockService.updateForm).toHaveBeenCalledWith('f1', dto);
    });
  });

  describe('deleteForm', () => {
    it('should delegate with formId', async () => {
      mockService.deleteForm.mockResolvedValue({ deleted: true });

      expect(await controller.deleteForm('f1')).toEqual({ deleted: true });
      expect(mockService.deleteForm).toHaveBeenCalledWith('f1');
    });
  });

  describe('setFields', () => {
    it('should delegate with formId and dto', async () => {
      const dto = { fields: [{ label: 'Name', type: 'text' }] } as any;
      const result = { updated: true };
      mockService.setFields.mockResolvedValue(result);

      expect(await controller.setFields('f1', dto)).toEqual(result);
      expect(mockService.setFields).toHaveBeenCalledWith('f1', dto);
    });
  });

  describe('submitResponse', () => {
    it('should merge formId into dto and pass clientId from @CurrentUser', async () => {
      const dto = { answers: [{ fieldId: 'fld1', value: 'Yes' }] } as any;
      const result = { id: 'resp-1' };
      mockService.submitResponse.mockResolvedValue(result);

      expect(await controller.submitResponse('f1', 'client-1', dto)).toEqual(result);
      expect(mockService.submitResponse).toHaveBeenCalledWith('client-1', {
        ...dto,
        formId: 'f1',
      });
    });
  });

  describe('getResponseByBooking', () => {
    it('should delegate with bookingId', async () => {
      const response = { id: 'resp-1', answers: [] };
      mockService.getResponseByBooking.mockResolvedValue(response);

      expect(await controller.getResponseByBooking('bk-1')).toEqual(response);
      expect(mockService.getResponseByBooking).toHaveBeenCalledWith('bk-1');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/intake-forms/intake-forms.controller.spec.ts --verbose`
Expected: 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/intake-forms/intake-forms.controller.spec.ts
git commit -m "test(intake-forms): add controller delegation tests"
```

---

### Task 8: Notifications Controller Tests

**Files:**
- Create: `backend/test/unit/notifications/notifications.controller.spec.ts`
- Covers: `backend/src/modules/notifications/notifications.controller.ts` (110 lines, 6 methods — all use @CurrentUser)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../../../src/modules/notifications/notifications.controller.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  getUnreadCount: jest.fn(),
  markAllAsRead: jest.fn(),
  markAsRead: jest.fn(),
  registerFcmToken: jest.fn(),
  unregisterFcmToken: jest.fn(),
};

const mockUser = { id: 'user-1' };

describe('NotificationsController', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  describe('findAll', () => {
    it('should pass userId and query to service', async () => {
      const query = { page: '1' } as any;
      const notifications = [{ id: 'n1', title: 'New booking' }];
      mockService.findAll.mockResolvedValue(notifications);

      expect(await controller.findAll(query, mockUser)).toEqual(notifications);
      expect(mockService.findAll).toHaveBeenCalledWith('user-1', query);
    });
  });

  describe('getUnreadCount', () => {
    it('should return count wrapped in object', async () => {
      mockService.getUnreadCount.mockResolvedValue(5);

      expect(await controller.getUnreadCount(mockUser)).toEqual({ count: 5 });
      expect(mockService.getUnreadCount).toHaveBeenCalledWith('user-1');
    });
  });

  describe('markAllAsRead', () => {
    it('should return updated: true after calling service', async () => {
      mockService.markAllAsRead.mockResolvedValue(undefined);

      expect(await controller.markAllAsRead(mockUser)).toEqual({ updated: true });
      expect(mockService.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('markAsRead', () => {
    it('should pass notification id and userId', async () => {
      const result = { id: 'n1', readAt: new Date() };
      mockService.markAsRead.mockResolvedValue(result);

      expect(await controller.markAsRead('n1', mockUser)).toEqual(result);
      expect(mockService.markAsRead).toHaveBeenCalledWith('n1', 'user-1');
    });
  });

  describe('registerFcmToken', () => {
    it('should pass userId and dto', async () => {
      const dto = { token: 'fcm-token-abc' } as any;
      const result = { registered: true };
      mockService.registerFcmToken.mockResolvedValue(result);

      expect(await controller.registerFcmToken(dto, mockUser)).toEqual(result);
      expect(mockService.registerFcmToken).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('unregisterFcmToken', () => {
    it('should return deleted: true after calling service', async () => {
      const dto = { token: 'fcm-token-abc' } as any;
      mockService.unregisterFcmToken.mockResolvedValue(undefined);

      expect(await controller.unregisterFcmToken(dto, mockUser)).toEqual({ deleted: true });
      expect(mockService.unregisterFcmToken).toHaveBeenCalledWith('user-1', 'fcm-token-abc');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/notifications/notifications.controller.spec.ts --verbose`
Expected: 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/notifications/notifications.controller.spec.ts
git commit -m "test(notifications): add controller delegation tests"
```

---

### Task 9: Users Controller Tests

**Files:**
- Create: `backend/test/unit/users/users.controller.spec.ts`
- Covers: `backend/src/modules/users/users.controller.ts` (128 lines, 9 methods — uses 2 services + @CurrentUser + query parsing)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../../src/modules/users/users.controller.js';
import { UsersService } from '../../../src/modules/users/users.service.js';
import { UserRolesService } from '../../../src/modules/users/user-roles.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockUsersService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  activate: jest.fn(),
  deactivate: jest.fn(),
};

const mockUserRolesService = {
  assignRole: jest.fn(),
  removeRole: jest.fn(),
};

const mockUser = { id: 'user-1' };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: UserRolesService, useValue: mockUserRolesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('findAll', () => {
    it('should parse query params and delegate', async () => {
      const data = [{ id: 'u1' }];
      mockUsersService.findAll.mockResolvedValue(data);

      const result = await controller.findAll('1', '20', 'name', 'asc', 'ahmed', 'admin', 'true');

      expect(mockUsersService.findAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        search: 'ahmed',
        role: 'admin',
        isActive: true,
      });
      expect(result).toEqual(data);
    });

    it('should pass undefined for missing optional params', async () => {
      mockUsersService.findAll.mockResolvedValue([]);

      await controller.findAll(undefined, undefined, undefined, undefined, undefined, undefined, undefined);

      expect(mockUsersService.findAll).toHaveBeenCalledWith({
        page: undefined,
        perPage: undefined,
        sortBy: undefined,
        sortOrder: undefined,
        search: undefined,
        role: undefined,
        isActive: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('should delegate with id', async () => {
      const user = { id: 'u1', name: 'Ahmed' };
      mockUsersService.findOne.mockResolvedValue(user);

      expect(await controller.findOne('u1')).toEqual(user);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('u1');
    });
  });

  describe('create', () => {
    it('should pass dto and current user id, wrap in success envelope', async () => {
      const dto = { email: 'new@clinic.com' } as any;
      const created = { id: 'u2', email: 'new@clinic.com' };
      mockUsersService.create.mockResolvedValue(created);

      const result = await controller.create(dto, mockUser);

      expect(result).toEqual({ success: true, data: created, message: 'User created successfully' });
      expect(mockUsersService.create).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('update', () => {
    it('should delegate with id and dto', async () => {
      const dto = { firstName: 'Updated' } as any;
      const updated = { id: 'u1', firstName: 'Updated' };
      mockUsersService.update.mockResolvedValue(updated);

      expect(await controller.update('u1', dto)).toEqual(updated);
      expect(mockUsersService.update).toHaveBeenCalledWith('u1', dto);
    });
  });

  describe('delete', () => {
    it('should call softDelete with id and current user id', async () => {
      mockUsersService.softDelete.mockResolvedValue(undefined);

      expect(await controller.delete('u1', mockUser)).toEqual({ deleted: true });
      expect(mockUsersService.softDelete).toHaveBeenCalledWith('u1', 'user-1');
    });
  });

  describe('activate', () => {
    it('should delegate with id', async () => {
      const result = { id: 'u1', isActive: true };
      mockUsersService.activate.mockResolvedValue(result);

      expect(await controller.activate('u1')).toEqual(result);
      expect(mockUsersService.activate).toHaveBeenCalledWith('u1');
    });
  });

  describe('deactivate', () => {
    it('should pass id and current user id', async () => {
      const result = { id: 'u1', isActive: false };
      mockUsersService.deactivate.mockResolvedValue(result);

      expect(await controller.deactivate('u1', mockUser)).toEqual(result);
      expect(mockUsersService.deactivate).toHaveBeenCalledWith('u1', 'user-1');
    });
  });

  describe('assignRole', () => {
    it('should pass all params to userRolesService', async () => {
      const dto = { roleId: 'r1', roleSlug: 'admin' } as any;
      mockUserRolesService.assignRole.mockResolvedValue(undefined);
      const requester = { id: 'req-1' };

      const result = await controller.assignRole('u1', dto, requester);

      expect(result).toEqual({ success: true, message: 'Role assigned successfully' });
      expect(mockUserRolesService.assignRole).toHaveBeenCalledWith('u1', 'r1', 'admin', 'req-1');
    });
  });

  describe('removeRole', () => {
    it('should delegate with userId and roleId', async () => {
      mockUserRolesService.removeRole.mockResolvedValue(undefined);

      expect(await controller.removeRole('u1', 'r1')).toEqual({ removed: true });
      expect(mockUserRolesService.removeRole).toHaveBeenCalledWith('u1', 'r1');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/users/users.controller.spec.ts --verbose`
Expected: 10 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/users/users.controller.spec.ts
git commit -m "test(users): add controller delegation tests"
```

---

### Task 10: Services Controller Tests

**Files:**
- Create: `backend/test/unit/services/services.controller.spec.ts`
- Covers: `backend/src/modules/services/services.controller.ts` (213 lines, 18 methods, 6 injected services)

- [ ] **Step 1: Write the test file**

```typescript
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ServicesController } from '../../../src/modules/services/services.controller.js';
import { ServiceCategoriesService } from '../../../src/modules/services/service-categories.service.js';
import { ServicesService } from '../../../src/modules/services/services.service.js';
import { ServicesAvatarService } from '../../../src/modules/services/services-avatar.service.js';
import { DurationOptionsService } from '../../../src/modules/services/duration-options.service.js';
import { ServiceBookingTypeService } from '../../../src/modules/services/service-booking-type.service.js';
import { ServiceEmployeesService } from '../../../src/modules/services/service-employees.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockCategories = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockServices = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  setBranches: jest.fn(),
  clearBranches: jest.fn(),
  getIntakeForms: jest.fn(),
};
const mockAvatar = { uploadAvatar: jest.fn() };
const mockDuration = { getDurationOptions: jest.fn(), setDurationOptions: jest.fn() };
const mockBookingType = { getByService: jest.fn(), setBookingTypes: jest.fn() };
const mockEmployees = { getEmployeesForService: jest.fn() };

describe('ServicesController', () => {
  let controller: ServicesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [
        { provide: ServiceCategoriesService, useValue: mockCategories },
        { provide: ServicesService, useValue: mockServices },
        { provide: ServicesAvatarService, useValue: mockAvatar },
        { provide: DurationOptionsService, useValue: mockDuration },
        { provide: ServiceBookingTypeService, useValue: mockBookingType },
        { provide: ServiceEmployeesService, useValue: mockEmployees },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ServicesController>(ServicesController);
  });

  // ── Categories ──────────────────────────────────────────────────

  describe('findAllCategories', () => {
    it('should delegate to categoriesService.findAll', async () => {
      const cats = [{ id: 'cat1' }];
      mockCategories.findAll.mockResolvedValue(cats);
      expect(await controller.findAllCategories()).toEqual(cats);
    });
  });

  describe('createCategory', () => {
    it('should delegate with dto', async () => {
      const dto = { nameAr: 'تجميل' } as any;
      const created = { id: 'cat2', ...dto };
      mockCategories.create.mockResolvedValue(created);
      expect(await controller.createCategory(dto)).toEqual(created);
      expect(mockCategories.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateCategory', () => {
    it('should delegate with id and dto', async () => {
      const dto = { nameAr: 'جلدية' } as any;
      mockCategories.update.mockResolvedValue({ id: 'cat1' });
      await controller.updateCategory('cat1', dto);
      expect(mockCategories.update).toHaveBeenCalledWith('cat1', dto);
    });
  });

  describe('deleteCategory', () => {
    it('should delegate with id', async () => {
      mockCategories.delete.mockResolvedValue({ deleted: true });
      expect(await controller.deleteCategory('cat1')).toEqual({ deleted: true });
    });
  });

  // ── Services CRUD ───────────────────────────────────────────────

  describe('findAll', () => {
    it('should delegate with query', async () => {
      const query = { page: 1 } as any;
      const data = [{ id: 'svc1' }];
      mockServices.findAll.mockResolvedValue(data);
      expect(await controller.findAll(query)).toEqual(data);
      expect(mockServices.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should delegate with id', async () => {
      const svc = { id: 'svc1', nameAr: 'فحص' };
      mockServices.findOne.mockResolvedValue(svc);
      expect(await controller.findOne('svc1')).toEqual(svc);
    });
  });

  describe('create', () => {
    it('should delegate with dto', async () => {
      const dto = { nameAr: 'فحص جديد' } as any;
      mockServices.create.mockResolvedValue({ id: 'svc2' });
      await controller.create(dto);
      expect(mockServices.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should delegate with id and dto', async () => {
      const dto = { nameAr: 'محدث' } as any;
      mockServices.update.mockResolvedValue({ id: 'svc1' });
      await controller.update('svc1', dto);
      expect(mockServices.update).toHaveBeenCalledWith('svc1', dto);
    });
  });

  describe('uploadAvatar', () => {
    it('should delegate to avatarService when file is provided', async () => {
      const file = { originalname: 'photo.jpg', buffer: Buffer.from('img') } as any;
      mockAvatar.uploadAvatar.mockResolvedValue({ url: 'https://cdn/photo.jpg' });

      const result = await controller.uploadAvatar('svc1', file);

      expect(mockAvatar.uploadAvatar).toHaveBeenCalledWith('svc1', file);
      expect(result).toEqual({ url: 'https://cdn/photo.jpg' });
    });

    it('should throw BadRequestException when no file', async () => {
      await expect(controller.uploadAvatar('svc1', undefined as any))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('setBranches', () => {
    it('should delegate and return updated: true', async () => {
      const dto = { branchIds: ['b1', 'b2'] } as any;
      mockServices.setBranches.mockResolvedValue(undefined);

      expect(await controller.setBranches('svc1', dto)).toEqual({ updated: true });
      expect(mockServices.setBranches).toHaveBeenCalledWith('svc1', ['b1', 'b2']);
    });
  });

  describe('clearBranches', () => {
    it('should delegate and return cleared: true', async () => {
      mockServices.clearBranches.mockResolvedValue(undefined);

      expect(await controller.clearBranches('svc1')).toEqual({ cleared: true });
      expect(mockServices.clearBranches).toHaveBeenCalledWith('svc1');
    });
  });

  describe('softDelete', () => {
    it('should delegate with id', async () => {
      mockServices.softDelete.mockResolvedValue({ deleted: true });
      expect(await controller.softDelete('svc1')).toEqual({ deleted: true });
    });
  });

  describe('getIntakeForms', () => {
    it('should delegate with id', async () => {
      const forms = [{ id: 'f1' }];
      mockServices.getIntakeForms.mockResolvedValue(forms);
      expect(await controller.getIntakeForms('svc1')).toEqual(forms);
    });
  });

  // ── Duration Options ────────────────────────────────────────────

  describe('getDurationOptions', () => {
    it('should delegate with id', async () => {
      const opts = [{ duration: 30, price: 100 }];
      mockDuration.getDurationOptions.mockResolvedValue(opts);
      expect(await controller.getDurationOptions('svc1')).toEqual(opts);
    });
  });

  describe('setDurationOptions', () => {
    it('should delegate with id and dto', async () => {
      const dto = { options: [{ duration: 60, price: 200 }] } as any;
      mockDuration.setDurationOptions.mockResolvedValue({ updated: true });
      await controller.setDurationOptions('svc1', dto);
      expect(mockDuration.setDurationOptions).toHaveBeenCalledWith('svc1', dto);
    });
  });

  // ── Employees ───────────────────────────────────────────────

  describe('getEmployees', () => {
    it('should delegate with id and optional branchId', async () => {
      const employees = [{ id: 'p1' }];
      mockEmployees.getEmployeesForService.mockResolvedValue(employees);

      expect(await controller.getEmployees('svc1', 'b1')).toEqual(employees);
      expect(mockEmployees.getEmployeesForService).toHaveBeenCalledWith('svc1', 'b1');
    });

    it('should work without branchId', async () => {
      mockEmployees.getEmployeesForService.mockResolvedValue([]);
      await controller.getEmployees('svc1', undefined);
      expect(mockEmployees.getEmployeesForService).toHaveBeenCalledWith('svc1', undefined);
    });
  });

  // ── Booking Types ───────────────────────────────────────────────

  describe('getBookingTypes', () => {
    it('should delegate with id', async () => {
      const types = [{ id: 'bt1', name: 'in-clinic' }];
      mockBookingType.getByService.mockResolvedValue(types);
      expect(await controller.getBookingTypes('svc1')).toEqual(types);
    });
  });

  describe('setBookingTypes', () => {
    it('should delegate with id and dto', async () => {
      const dto = { types: ['in-clinic', 'video'] } as any;
      mockBookingType.setBookingTypes.mockResolvedValue({ updated: true });
      await controller.setBookingTypes('svc1', dto);
      expect(mockBookingType.setBookingTypes).toHaveBeenCalledWith('svc1', dto);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/services/services.controller.spec.ts --verbose`
Expected: 20 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/services/services.controller.spec.ts
git commit -m "test(services): add controller delegation tests for 18 endpoints"
```

---

### Task 11: Clinic Controllers Tests (3 controllers in 1 file)

**Files:**
- Create: `backend/test/unit/clinic/clinic-controllers.spec.ts`
- Covers: 3 controllers — `clinic-holidays.controller.ts` (46 lines, 3 methods), `business-hours.controller.ts` (29 lines, 2 methods), `organization-settings.controller.ts` (58 lines, 5 methods)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ClinicHolidaysController } from '../../../src/modules/clinic/clinic-holidays.controller.js';
import { BusinessHoursController } from '../../../src/modules/clinic/business-hours.controller.js';
import { OrganizationSettingsController } from '../../../src/modules/clinic/organization-settings.controller.js';
import { ClinicHolidaysService } from '../../../src/modules/clinic/clinic-holidays.service.js';
import { BusinessHoursService } from '../../../src/modules/clinic/business-hours.service.js';
import { OrganizationSettingsService } from '../../../src/modules/clinic/organization-settings.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

// ── Mocks ────────────────────────────────────────────────────────

const mockHolidays = {
  findAll: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

const mockHours = {
  getAll: jest.fn(),
  setHours: jest.fn(),
};

const mockSettings = {
  getPublicSettings: jest.fn(),
  getBookingFlowOrder: jest.fn(),
  updateBookingFlowOrder: jest.fn(),
  getPaymentSettings: jest.fn(),
  updatePaymentSettings: jest.fn(),
};

const guardOverrides = (builder: any) =>
  builder
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(PermissionsGuard)
    .useValue({ canActivate: () => true });

// ── Holidays ─────────────────────────────────────────────────────

describe('ClinicHolidaysController', () => {
  let controller: ClinicHolidaysController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await guardOverrides(
      Test.createTestingModule({
        controllers: [ClinicHolidaysController],
        providers: [{ provide: ClinicHolidaysService, useValue: mockHolidays }],
      }),
    ).compile();
    controller = module.get<ClinicHolidaysController>(ClinicHolidaysController);
  });

  describe('findAll', () => {
    it('should parse year and wrap in success envelope', async () => {
      const holidays = [{ id: 'h1', date: '2026-01-01' }];
      mockHolidays.findAll.mockResolvedValue(holidays);

      expect(await controller.findAll('2026')).toEqual({ success: true, data: holidays });
      expect(mockHolidays.findAll).toHaveBeenCalledWith(2026);
    });

    it('should pass undefined when year not provided', async () => {
      mockHolidays.findAll.mockResolvedValue([]);
      await controller.findAll(undefined);
      expect(mockHolidays.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe('create', () => {
    it('should delegate with dto', async () => {
      const dto = { date: '2026-09-23', nameAr: 'اليوم الوطني' } as any;
      const created = { id: 'h2', ...dto };
      mockHolidays.create.mockResolvedValue(created);

      expect(await controller.create(dto)).toEqual({ success: true, data: created });
      expect(mockHolidays.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('remove', () => {
    it('should delegate and return null data', async () => {
      mockHolidays.delete.mockResolvedValue(undefined);

      expect(await controller.remove('h1')).toEqual({ success: true, data: null });
      expect(mockHolidays.delete).toHaveBeenCalledWith('h1');
    });
  });
});

// ── Hours ────────────────────────────────────────────────────────

describe('BusinessHoursController', () => {
  let controller: BusinessHoursController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await guardOverrides(
      Test.createTestingModule({
        controllers: [BusinessHoursController],
        providers: [{ provide: BusinessHoursService, useValue: mockHours }],
      }),
    ).compile();
    controller = module.get<BusinessHoursController>(BusinessHoursController);
  });

  describe('getAll', () => {
    it('should wrap result in success envelope', async () => {
      const hours = [{ day: 0, open: '08:00', close: '16:00' }];
      mockHours.getAll.mockResolvedValue(hours);

      expect(await controller.getAll()).toEqual({ success: true, data: hours });
    });
  });

  describe('setHours', () => {
    it('should delegate with dto', async () => {
      const dto = { hours: [{ day: 0, open: '09:00', close: '17:00' }] } as any;
      const result = [{ day: 0, open: '09:00', close: '17:00' }];
      mockHours.setHours.mockResolvedValue(result);

      expect(await controller.setHours(dto)).toEqual({ success: true, data: result });
      expect(mockHours.setHours).toHaveBeenCalledWith(dto);
    });
  });
});

// ── Settings ─────────────────────────────────────────────────────

describe('OrganizationSettingsController', () => {
  let controller: OrganizationSettingsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await guardOverrides(
      Test.createTestingModule({
        controllers: [OrganizationSettingsController],
        providers: [{ provide: OrganizationSettingsService, useValue: mockSettings }],
      }),
    ).compile();
    controller = module.get<OrganizationSettingsController>(OrganizationSettingsController);
  });

  describe('getPublicSettings', () => {
    it('should wrap result', async () => {
      const settings = { clinicName: 'Deqah Demo' };
      mockSettings.getPublicSettings.mockResolvedValue(settings);

      expect(await controller.getPublicSettings()).toEqual({ success: true, data: settings });
    });
  });

  describe('getBookingFlowOrder', () => {
    it('should wrap order in nested object', async () => {
      mockSettings.getBookingFlowOrder.mockResolvedValue(['service', 'employee', 'time']);

      expect(await controller.getBookingFlowOrder()).toEqual({
        success: true,
        data: { bookingFlowOrder: ['service', 'employee', 'time'] },
      });
    });
  });

  describe('updateBookingFlowOrder', () => {
    it('should extract order from dto and wrap result', async () => {
      const dto = { order: ['employee', 'service', 'time'] } as any;
      mockSettings.updateBookingFlowOrder.mockResolvedValue(['employee', 'service', 'time']);

      expect(await controller.updateBookingFlowOrder(dto)).toEqual({
        success: true,
        data: { bookingFlowOrder: ['employee', 'service', 'time'] },
      });
      expect(mockSettings.updateBookingFlowOrder).toHaveBeenCalledWith(dto.order);
    });
  });

  describe('getPaymentSettings', () => {
    it('should wrap result', async () => {
      const data = { provider: 'moyasar', enabled: true };
      mockSettings.getPaymentSettings.mockResolvedValue(data);

      expect(await controller.getPaymentSettings()).toEqual({ success: true, data });
    });
  });

  describe('updatePaymentSettings', () => {
    it('should delegate with dto', async () => {
      const dto = { enabled: false } as any;
      const result = { provider: 'moyasar', enabled: false };
      mockSettings.updatePaymentSettings.mockResolvedValue(result);

      expect(await controller.updatePaymentSettings(dto)).toEqual({ success: true, data: result });
      expect(mockSettings.updatePaymentSettings).toHaveBeenCalledWith(dto);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/clinic/clinic-controllers.spec.ts --verbose`
Expected: 12 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/clinic/clinic-controllers.spec.ts
git commit -m "test(clinic): add delegation tests for holidays, hours, and settings controllers"
```

---

### Task 12: Chatbot Controller Tests

**Files:**
- Create: `backend/test/unit/chatbot/chatbot.controller.spec.ts`
- Covers: `backend/src/modules/chatbot/chatbot.controller.ts` (147 lines, 7 methods — includes SSE streaming)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { Subject } from 'rxjs';
import { ChatbotController } from '../../../src/modules/chatbot/chatbot.controller.js';
import { ChatbotService } from '../../../src/modules/chatbot/chatbot.service.js';
import { ChatbotStreamService } from '../../../src/modules/chatbot/chatbot-stream.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockChatbotService = {
  createSession: jest.fn(),
  listSessions: jest.fn(),
  getSession: jest.fn(),
  handleMessage: jest.fn(),
  endSession: jest.fn(),
};

const mockStreamService = {
  handleMessageStream: jest.fn(),
};

const adminUser = { id: 'admin-1', roles: [{ slug: 'super_admin' }] };
const clientUser = { id: 'client-1', roles: [{ slug: 'client' }] };

describe('ChatbotController', () => {
  let controller: ChatbotController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatbotController],
      providers: [
        { provide: ChatbotService, useValue: mockChatbotService },
        { provide: ChatbotStreamService, useValue: mockStreamService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ChatbotController>(ChatbotController);
  });

  describe('createSession', () => {
    it('should pass userId and language', async () => {
      const dto = { language: 'ar' } as any;
      const session = { id: 'sess-1' };
      mockChatbotService.createSession.mockResolvedValue(session);

      expect(await controller.createSession(dto, clientUser)).toEqual(session);
      expect(mockChatbotService.createSession).toHaveBeenCalledWith('client-1', 'ar');
    });
  });

  describe('listSessions', () => {
    it('should pass userId for non-admin users', async () => {
      const query = { page: '2', perPage: '10' } as any;
      mockChatbotService.listSessions.mockResolvedValue({ data: [], total: 0 });

      await controller.listSessions(query, clientUser);

      expect(mockChatbotService.listSessions).toHaveBeenCalledWith({
        userId: 'client-1',
        page: 2,
        perPage: 10,
        handedOff: undefined,
        language: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
    });

    it('should pass undefined userId for admin users', async () => {
      const query = { page: '1', handedOff: 'true' } as any;
      mockChatbotService.listSessions.mockResolvedValue({ data: [] });

      await controller.listSessions(query, adminUser);

      expect(mockChatbotService.listSessions).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined, handedOff: true }),
      );
    });
  });

  describe('getSession', () => {
    it('should delegate with session id and user id', async () => {
      const session = { id: 'sess-1', messages: [] };
      mockChatbotService.getSession.mockResolvedValue(session);

      expect(await controller.getSession('sess-1', clientUser)).toEqual(session);
      expect(mockChatbotService.getSession).toHaveBeenCalledWith('sess-1', 'client-1');
    });
  });

  describe('sendMessage', () => {
    it('should delegate with session id, user id, and content', async () => {
      const dto = { content: 'ما هي مواعيد العمل؟' } as any;
      const result = { reply: 'من 8 صباحا...' };
      mockChatbotService.handleMessage.mockResolvedValue(result);

      expect(await controller.sendMessage('sess-1', dto, clientUser)).toEqual(result);
      expect(mockChatbotService.handleMessage).toHaveBeenCalledWith(
        'sess-1',
        'client-1',
        'ما هي مواعيد العمل؟',
      );
    });
  });

  describe('streamMessage', () => {
    it('should set SSE headers and pipe observable to response', async () => {
      const dto = { content: 'مرحبا' } as any;
      const subject = new Subject();
      mockStreamService.handleMessageStream.mockReturnValue(subject.asObservable());

      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };

      // Start streaming (non-blocking since subscribe is sync)
      await controller.streamMessage('sess-1', dto, clientUser, mockRes as any);

      // Verify headers
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockRes.flushHeaders).toHaveBeenCalled();

      // Emit events
      subject.next({ data: 'Hello' });
      expect(mockRes.write).toHaveBeenCalledWith('data: Hello\n\n');

      subject.next({ data: { event: 'tool', name: 'search' } });
      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ event: 'tool', name: 'search' })}\n\n`,
      );

      // Complete
      subject.complete();
      expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle stream errors', async () => {
      const dto = { content: 'test' } as any;
      const subject = new Subject();
      mockStreamService.handleMessageStream.mockReturnValue(subject.asObservable());

      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };

      await controller.streamMessage('sess-1', dto, clientUser, mockRes as any);

      subject.error(new Error('LLM timeout'));

      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ event: 'error', message: 'LLM timeout' })}\n\n`,
      );
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('endSession', () => {
    it('should delegate with session id and user id', async () => {
      const result = { ended: true };
      mockChatbotService.endSession.mockResolvedValue(result);

      expect(await controller.endSession('sess-1', clientUser)).toEqual(result);
      expect(mockChatbotService.endSession).toHaveBeenCalledWith('sess-1', 'client-1');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/chatbot/chatbot.controller.spec.ts --verbose`
Expected: 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/chatbot/chatbot.controller.spec.ts
git commit -m "test(chatbot): add controller delegation tests including SSE streaming"
```

---

### Task 13: Tasks Processor Tests

**Files:**
- Create: `backend/test/unit/tasks/tasks.processor.spec.ts`
- Covers: `backend/src/modules/tasks/tasks.processor.ts` (90 lines — 14 job types + onModuleInit failure handler)

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TasksProcessor } from '../../../src/modules/tasks/tasks.processor.js';
import { CleanupService } from '../../../src/modules/tasks/cleanup.service.js';
import { ReminderService } from '../../../src/modules/tasks/reminder.service.js';
import { BookingAutomationService } from '../../../src/modules/tasks/booking-automation.service.js';
import { QueueFailureService } from '../../../src/common/queue/queue-failure.service.js';
import { QUEUE_TASKS } from '../../../src/config/constants/queues.js';

const mockCleanup = {
  cleanExpiredOtps: jest.fn(),
  cleanExpiredRefreshTokens: jest.fn(),
  cleanOldProcessedWebhooks: jest.fn(),
  archiveOldActivityLogs: jest.fn(),
  repairEmployeeRatingCache: jest.fn(),
  logTableGrowthSnapshot: jest.fn(),
};

const mockReminder = {
  sendDayBeforeReminders: jest.fn(),
  sendHourBeforeReminders: jest.fn(),
  sendTwoHourReminders: jest.fn(),
  sendUrgentReminders: jest.fn(),
};

const mockAutomation = {
  expirePendingBookings: jest.fn(),
  autoCompleteBookings: jest.fn(),
  autoNoShow: jest.fn(),
  autoExpirePendingCancellations: jest.fn(),
};

const mockQueueFailure = {
  notifyAdminsOfFailure: jest.fn(),
};

describe('TasksProcessor', () => {
  let processor: TasksProcessor;
  let workerOnHandlers: Record<string, Function>;

  beforeEach(async () => {
    jest.clearAllMocks();
    workerOnHandlers = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksProcessor,
        { provide: CleanupService, useValue: mockCleanup },
        { provide: ReminderService, useValue: mockReminder },
        { provide: BookingAutomationService, useValue: mockAutomation },
        { provide: QueueFailureService, useValue: mockQueueFailure },
      ],
    }).compile();

    processor = module.get<TasksProcessor>(TasksProcessor);

    // Mock the worker object that BullMQ provides
    (processor as any).worker = {
      on: jest.fn((event: string, handler: Function) => {
        workerOnHandlers[event] = handler;
      }),
    };
  });

  // ── Job routing ─────────────────────────────────────────────────

  const jobCases: Array<[string, () => jest.Mock]> = [
    ['cleanup-otps', () => mockCleanup.cleanExpiredOtps],
    ['cleanup-tokens', () => mockCleanup.cleanExpiredRefreshTokens],
    ['cleanup-webhooks', () => mockCleanup.cleanOldProcessedWebhooks],
    ['archive-activity-logs', () => mockCleanup.archiveOldActivityLogs],
    ['repair-rating-cache', () => mockCleanup.repairEmployeeRatingCache],
    ['db-snapshot', () => mockCleanup.logTableGrowthSnapshot],
    ['reminder-24h', () => mockReminder.sendDayBeforeReminders],
    ['reminder-1h', () => mockReminder.sendHourBeforeReminders],
    ['reminder-2h', () => mockReminder.sendTwoHourReminders],
    ['reminder-15min', () => mockReminder.sendUrgentReminders],
    ['expire-pending-bookings', () => mockAutomation.expirePendingBookings],
    ['auto-complete-bookings', () => mockAutomation.autoCompleteBookings],
    ['auto-no-show', () => mockAutomation.autoNoShow],
    ['expire-pending-cancellations', () => mockAutomation.autoExpirePendingCancellations],
  ];

  it.each(jobCases)('should route job "%s" to the correct service method', async (jobName, getMock) => {
    const job = { name: jobName } as any;
    getMock().mockResolvedValue(undefined);

    await processor.process(job);

    expect(getMock()).toHaveBeenCalledTimes(1);
  });

  it('should log warning for unknown job names', async () => {
    const loggerSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation();
    const job = { name: 'unknown-job' } as any;

    await processor.process(job);

    expect(loggerSpy).toHaveBeenCalledWith('Unknown task job: unknown-job');
    loggerSpy.mockRestore();
  });

  // ── onModuleInit (failure handler) ──────────────────────────────

  describe('onModuleInit', () => {
    it('should register a failed handler on worker', () => {
      processor.onModuleInit();
      expect((processor as any).worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('should notify admins when job failure is final (attempts exhausted)', async () => {
      processor.onModuleInit();
      const handler = workerOnHandlers['failed'];

      const job = { name: 'cleanup-otps', id: 'job-1', data: {}, attemptsMade: 3, opts: { attempts: 3 } };
      const error = new Error('DB connection lost');

      await handler(job, error);

      expect(mockQueueFailure.notifyAdminsOfFailure).toHaveBeenCalledWith(
        QUEUE_TASKS,
        'cleanup-otps',
        'job-1',
        {},
        error,
      );
    });

    it('should notify admins for UnrecoverableError regardless of attempts', async () => {
      processor.onModuleInit();
      const handler = workerOnHandlers['failed'];

      const job = { name: 'reminder-1h', id: 'job-2', data: {}, attemptsMade: 1, opts: { attempts: 3 } };
      const error = Object.assign(new Error('Unrecoverable'), { name: 'UnrecoverableError' });

      await handler(job, error);

      expect(mockQueueFailure.notifyAdminsOfFailure).toHaveBeenCalled();
    });

    it('should NOT notify admins for non-final failures', async () => {
      processor.onModuleInit();
      const handler = workerOnHandlers['failed'];

      const job = { name: 'cleanup-otps', id: 'job-3', data: {}, attemptsMade: 1, opts: { attempts: 3 } };
      const error = new Error('Temporary');

      await handler(job, error);

      expect(mockQueueFailure.notifyAdminsOfFailure).not.toHaveBeenCalled();
    });

    it('should handle null job gracefully', async () => {
      processor.onModuleInit();
      const handler = workerOnHandlers['failed'];

      const error = Object.assign(new Error('Fatal'), { name: 'UnrecoverableError' });

      await handler(null, error);

      expect(mockQueueFailure.notifyAdminsOfFailure).toHaveBeenCalledWith(
        QUEUE_TASKS,
        'unknown',
        undefined,
        undefined,
        error,
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/tasks/tasks.processor.spec.ts --verbose`
Expected: 19 tests PASS (14 job routes + 1 unknown + 4 onModuleInit)

- [ ] **Step 3: Commit**

```bash
git add backend/test/unit/tasks/tasks.processor.spec.ts
git commit -m "test(tasks): add processor tests for 14 job types and failure handler"
```

---

### Task 14: Raise Coverage Thresholds

**Files:**
- Modify: `backend/package.json` (coverage thresholds section)

- [ ] **Step 1: Run coverage and verify improvement**

Run: `cd backend && npm run test:cov -- --silent 2>&1 | grep "All files"`
Expected: All metrics should be above 75% after adding all the above tests.

- [ ] **Step 2: Update coverage thresholds**

In `backend/package.json`, update the `coverageThreshold` to match the new reality:

```json
"coverageThreshold": {
  "global": {
    "branches": 65,
    "functions": 65,
    "lines": 70,
    "statements": 70
  }
}
```

- [ ] **Step 3: Run tests with new thresholds to confirm they pass**

Run: `cd backend && npm run test:cov`
Expected: All tests pass, coverage thresholds met.

- [ ] **Step 4: Commit**

```bash
git add backend/package.json
git commit -m "chore: raise coverage thresholds to 65% branches, 70% lines"
```

---

### Task 15: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `cd backend && npm run test:cov 2>&1 | tail -20`
Expected: All suites pass, global coverage >70% lines.

- [ ] **Step 2: Verify no regressions in existing tests**

Run: `cd backend && npm run test -- --verbose 2>&1 | tail -5`
Expected: Same number of suites as before + 13 new ones = ~153 suites total.
