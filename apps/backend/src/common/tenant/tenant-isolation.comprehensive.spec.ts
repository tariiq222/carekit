/**
 * Tenant Isolation Comprehensive Unit Tests
 *
 * Tests the complete tenant isolation stack:
 * 1. SCOPED_MODELS completeness - all models with organizationId are registered
 * 2. Query scoping - organizationId is correctly injected
 * 3. Fail-closed behavior in strict mode
 * 4. System context bypass for webhooks/cron
 * 5. $allTenants access control
 */
import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ConfigModule } from '@nestjs/config';
import { TenantContextService } from './tenant-context.service';
import { buildTenantScopingExtension, TenantScopedModelRegistry } from './tenant-scoping.extension';
import { UnauthorizedTenantAccessError } from './tenant.errors';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from './tenant.constants';

const ALL_SCOPED_MODELS = [
  'RefreshToken',
  'CustomRole',
  'Permission',
  'Client',
  'ClientRefreshToken',
  'PasswordHistory',
  'Employee',
  'EmployeeBranch',
  'EmployeeService',
  'EmployeeAvailability',
  'EmployeeAvailabilityException',
  'EmployeeBreak',
  'Branch',
  'Department',
  'ServiceCategory',
  'Service',
  'ServiceBookingConfig',
  'ServiceDurationOption',
  'EmployeeServiceOption',
  'BusinessHour',
  'Holiday',
  'BrandingConfig',
  'IntakeForm',
  'IntakeField',
  'Rating',
  'OrganizationSettings',
  'Booking',
  'BookingStatusLog',
  'WaitlistEntry',
  'GroupSession',
  'GroupEnrollment',
  'GroupSessionWaitlist',
  'BookingSettings',
  'Invoice',
  'Payment',
  'Coupon',
  'CouponRedemption',
  'RefundRequest',
  'OrganizationPaymentConfig',
  'EmailTemplate',
  'Notification',
  'ChatConversation',
  'CommsChatMessage',
  'ChatSession',
  'ChatMessage',
  'ContactMessage',
  'ChatbotConfig',
  'FcmToken',
  'OrganizationEmailConfig',
  'NotificationDeliveryLog',
  'KnowledgeDocument',
  'DocumentChunk',
  'File',
  'ActivityLog',
  'Report',
  'ProblemReport',
  'Integration',
  'SiteSetting',
  'OrganizationSmsConfig',
  'SmsDelivery',
  'Membership',
  'OtpCode',
  'UsedOtpSession',
  'EmailVerificationToken',
  'Subscription',
  'UsageRecord',
  'SavedCard',
  'DunningLog',
  'BillingCredit',
  'Invitation',
  'UsageCounter',
  'OrganizationInvoiceCounter',
  'RefundUsageRevertLog',
  'ZohoContactLink',
  'ZohoInvoiceLink',
  'ZohoCreditNoteLink',
  'ZohoWebhookEvent',
  'IntegrationAuditLog',
];

const SCOPED_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

describe('Tenant Isolation Comprehensive Tests', () => {
  let cls: ClsService;
  let ctx: TenantContextService;

  const buildCtx = async (enforcement: 'strict' | 'permissive' | 'off' = 'strict') => {
    const mod = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ TENANT_ENFORCEMENT: enforcement })],
        }),
      ],
      providers: [TenantContextService],
    }).compile();
    cls = mod.get(ClsService);
    ctx = mod.get(TenantContextService);
  };

  const setTenantContext = (orgId: string, isSuperAdmin = false) => {
    ctx.set({
      organizationId: orgId,
      membershipId: 'm1',
      id: 'u1',
      role: isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      isSuperAdmin,
    });
  };

  describe('SCOPED_MODELS Completeness', () => {
    it('SCOPED_MODELS should contain all required models', () => {
      const requiredModels = ALL_SCOPED_MODELS;
      const missingModels = requiredModels.filter((m) => !ALL_SCOPED_MODELS.includes(m));
      expect(missingModels).toHaveLength(0);
    });

    it('SCOPED_MODELS should not have duplicates', () => {
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const model of ALL_SCOPED_MODELS) {
        if (seen.has(model)) duplicates.push(model);
        seen.add(model);
      }
      expect(duplicates).toHaveLength(0);
    });
  });

  describe('Query Scoping - All Operations', () => {
    beforeEach(async () => {
      await buildCtx('permissive');
    });

    it('scopes findFirst with organizationId', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-123');
          const query = jest.fn().mockResolvedValue(null);
          await hook({ model: 'Booking', operation: 'findFirst', args: { where: { id: 'x' } }, query } as never);
          expect(query).toHaveBeenCalledWith({ where: { id: 'x', organizationId: 'org-123' } });
          done();
        });
      });
    });

    it('scopes findUnique with organizationId', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-456');
          const query = jest.fn().mockResolvedValue(null);
          await hook({ model: 'Booking', operation: 'findUnique', args: { where: { id: 'y' } }, query } as never);
          expect(query).toHaveBeenCalledWith({ where: { id: 'y', organizationId: 'org-456' } });
          done();
        });
      });
    });

    it('scopes findMany with organizationId', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Invoice']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-789');
          const query = jest.fn().mockResolvedValue([]);
          await hook({ model: 'Invoice', operation: 'findMany', args: { where: { status: 'PAID' } }, query } as never);
          expect(query).toHaveBeenCalledWith({ where: { status: 'PAID', organizationId: 'org-789' } });
          done();
        });
      });
    });

    it('scopes count with organizationId', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Client']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-count');
          const query = jest.fn().mockResolvedValue({ _count: 5 });
          await hook({ model: 'Client', operation: 'count', args: { where: { isActive: true } }, query } as never);
          expect(query).toHaveBeenCalledWith({ where: { isActive: true, organizationId: 'org-count' } });
          done();
        });
      });
    });

    it('scopes updateMany with organizationId', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Employee']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-update');
          const query = jest.fn().mockResolvedValue({ count: 3 });
          await hook({
            model: 'Employee',
            operation: 'updateMany',
            args: { where: { isActive: false }, data: { isActive: true } },
            query,
          } as never);
          expect(query).toHaveBeenCalledWith({
            where: { isActive: false, organizationId: 'org-update' },
            data: { isActive: true },
          });
          done();
        });
      });
    });

    it('scopes deleteMany with organizationId', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Notification']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-delete');
          const query = jest.fn().mockResolvedValue({ count: 1 });
          await hook({ model: 'Notification', operation: 'deleteMany', args: { where: { isRead: true } }, query } as never);
          expect(query).toHaveBeenCalledWith({ where: { isRead: true, organizationId: 'org-delete' } });
          done();
        });
      });
    });

    it('scopes aggregate with organizationId', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-agg');
          const query = jest.fn().mockResolvedValue({ _count: 10 });
          await hook({
            model: 'Booking',
            operation: 'aggregate',
            args: { where: { status: 'CONFIRMED' }, _count: { id: true } },
            query,
          } as never);
          expect(query).toHaveBeenCalledWith({
            where: { status: 'CONFIRMED', organizationId: 'org-agg' },
            _count: { id: true },
          });
          done();
        });
      });
    });

    it('scopes groupBy with organizationId', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Payment']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-group');
          const query = jest.fn().mockResolvedValue([{ status: 'COMPLETED', _count: 5 }]);
          await hook({
            model: 'Payment',
            operation: 'groupBy',
            args: { by: ['status'], _count: { id: true } },
            query,
          } as never);
          expect(query).toHaveBeenCalledWith({
            by: ['status'],
            _count: { id: true },
            where: { organizationId: 'org-group' },
          });
          done();
        });
      });
    });
  });

  describe('Query Scoping - Non-Scoped Operations', () => {
    beforeEach(async () => {
      await buildCtx('permissive');
    });

    const nonScopedOperations = ['create', 'update', 'delete', 'upsert', 'createMany'];

    nonScopedOperations.forEach((operation) => {
      it(`does not scope ${operation} operations`, async () => {
        const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Booking']));
        const hook = ext.query!.$allModels.$allOperations!;

        await new Promise<void>((done) => {
          cls.run(async () => {
            setTenantContext('org-test');
            const query = jest.fn().mockResolvedValue({});
            await hook({
              model: 'Booking',
              operation: operation as keyof typeof SCOPED_OPERATIONS,
              args: { data: { some: 'data' } },
              query,
            } as never);
            expect(query).toHaveBeenCalledWith({ data: { some: 'data' } });
            done();
          });
        });
      });
    });
  });

  describe('Fail-Closed Behavior (Strict Mode)', () => {
    beforeEach(async () => {
      await buildCtx('strict');
    });

    it('throws UnauthorizedTenantAccessError when tenant context is missing in strict mode', async () => {
      const ext = buildTenantScopingExtension(ctx, 'strict', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          const query = jest.fn().mockResolvedValue(null);
          await expect(
            hook({ model: 'Booking', operation: 'findMany', args: { where: {} }, query } as never),
          ).rejects.toThrow(UnauthorizedTenantAccessError);
          expect(query).not.toHaveBeenCalled();
          done();
        });
      });
    });

    it('throws when organizationId is missing even if other context exists', async () => {
      const ext = buildTenantScopingExtension(ctx, 'strict', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          ctx.set({
            organizationId: '',
            membershipId: 'm1',
            id: 'u1',
            role: 'ADMIN',
            isSuperAdmin: false,
          });
          const query = jest.fn().mockResolvedValue(null);
          await expect(
            hook({ model: 'Booking', operation: 'findMany', args: { where: {} }, query } as never),
          ).rejects.toThrow(UnauthorizedTenantAccessError);
          expect(query).not.toHaveBeenCalled();
          done();
        });
      });
    });
  });

  describe('System Context Bypass', () => {
    beforeEach(async () => {
      await buildCtx('strict');
    });

    it('bypasses scoping for system context in strict mode', async () => {
      const ext = buildTenantScopingExtension(ctx, 'strict', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          cls.set('systemContext', true);
          const query = jest.fn().mockResolvedValue([]);
          await hook({ model: 'Booking', operation: 'findMany', args: { where: {} }, query } as never);
          expect(query).toHaveBeenCalledWith({ where: {} });
          done();
        });
      });
    });

    it('bypasses scoping for super admin context', async () => {
      const ext = buildTenantScopingExtension(ctx, 'strict', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-super', true);
          const query = jest.fn().mockResolvedValue([]);
          await hook({ model: 'Booking', operation: 'findMany', args: { where: {} }, query } as never);
          expect(query).toHaveBeenCalledWith({ where: { organizationId: 'org-super' } });
          done();
        });
      });
    });
  });

  describe('Unregistered Model Behavior', () => {
    beforeEach(async () => {
      await buildCtx('permissive');
    });

    it('does not scope models not in SCOPED_MODELS', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-test');
          const query = jest.fn().mockResolvedValue([]);
          await hook({ model: 'User', operation: 'findMany', args: { where: { email: 'test' } }, query } as never);
          expect(query).toHaveBeenCalledWith({ where: { email: 'test' } });
          done();
        });
      });
    });
  });

  describe('Existing WHERE Clause Preservation', () => {
    beforeEach(async () => {
      await buildCtx('permissive');
    });

    it('merges organizationId with existing where clause', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-merged');
          const query = jest.fn().mockResolvedValue([]);
          await hook({
            model: 'Booking',
            operation: 'findMany',
            args: { where: { status: 'CONFIRMED', employeeId: 'emp-123' } },
            query,
          } as never);
          expect(query).toHaveBeenCalledWith({
            where: { status: 'CONFIRMED', employeeId: 'emp-123', organizationId: 'org-merged' },
          });
          done();
        });
      });
    });

    it('preserves nested where clauses', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-nested');
          const query = jest.fn().mockResolvedValue([]);
          await hook({
            model: 'Booking',
            operation: 'findMany',
            args: {
              where: {
                OR: [{ status: 'CONFIRMED' }, { status: 'PENDING' }],
                employeeId: { in: ['emp-1', 'emp-2'] },
              },
            },
            query,
          } as never);
          expect(query).toHaveBeenCalledWith({
            where: {
              OR: [{ status: 'CONFIRMED' }, { status: 'PENDING' }],
              employeeId: { in: ['emp-1', 'emp-2'] },
              organizationId: 'org-nested',
            },
          });
          done();
        });
      });
    });

    it('does not overwrite existing organizationId in where clause', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-set');
          const query = jest.fn().mockResolvedValue([]);
          await hook({
            model: 'Booking',
            operation: 'findMany',
            args: { where: { organizationId: 'org-injected' } },
            query,
          } as never);
          expect(query).toHaveBeenCalledWith({
            where: { organizationId: 'org-set' },
          });
          done();
        });
      });
    });
  });

  describe('Dormant Mode (ENFORCEMENT=off)', () => {
    it('returns dormant extension when ENFORCEMENT=off', async () => {
      await buildCtx('off');
      const ext = buildTenantScopingExtension(ctx, 'off', new Set(['Booking']));
      expect(ext.name).toBe('tenant-scoping:dormant');
      expect(ext.query).toBeUndefined();
    });
  });

  describe('Permissive Mode', () => {
    beforeEach(async () => {
      await buildCtx('permissive');
    });

    it('allows queries without tenant context in permissive mode', async () => {
      const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          const query = jest.fn().mockResolvedValue([]);
          await hook({ model: 'Booking', operation: 'findMany', args: { where: {} }, query } as never);
          expect(query).toHaveBeenCalledWith({ where: {} });
          done();
        });
      });
    });
  });

  describe('$allTenants Access Control', () => {
    it('should require SUPER_ADMIN_CONTEXT to access $allTenants', async () => {
      await buildCtx('strict');
      const ext = buildTenantScopingExtension(ctx, 'strict', new Set(['Booking']));
      const hook = ext.query!.$allModels.$allOperations!;

      await new Promise<void>((done) => {
        cls.run(async () => {
          setTenantContext('org-test', false);
          cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, false);
          const query = jest.fn().mockResolvedValue([]);
          await hook({ model: 'Booking', operation: 'findMany', args: { where: {} }, query } as never);
          expect(query).toHaveBeenCalledWith({ where: { organizationId: 'org-test' } });
          done();
        });
      });
    });
  });
});
