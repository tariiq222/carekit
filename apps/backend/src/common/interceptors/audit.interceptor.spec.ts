import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ActivityAction } from '@prisma/client';
import {
  AuditInterceptor,
  deriveEntityFromHandler,
  mapMethodToAction,
} from './audit.interceptor';
import { RequestContextStorage } from '../http/request-context';

const makeCtx = (method = 'POST', url = '/api/v1/dashboard/bookings') =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        url,
        originalUrl: url,
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        user: { id: 'user-1', email: 'test@example.com' },
      }),
    }),
    getHandler: () => ({ name: 'CreateBookingHandler' }),
    getClass: () => ({ name: 'DashboardBookingsController' }),
  }) as unknown as ExecutionContext;

const makeHandler = (value: unknown = { id: 'entity-1' }, fail = false): CallHandler => ({
  handle: () => (fail ? throwError(() => new Error('boom')) : of(value)),
});

const buildPrisma = () => ({
  activityLog: {
    create: jest.fn().mockResolvedValue({ id: 'log-1' }),
  },
});

const buildTenant = () => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue('org-1'),
});

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let prisma: ReturnType<typeof buildPrisma>;
  let tenant: ReturnType<typeof buildTenant>;

  beforeEach(() => {
    prisma = buildPrisma();
    tenant = buildTenant();
    interceptor = new AuditInterceptor(prisma as never, tenant as never);
    jest.clearAllMocks();
  });

  describe('deriveEntityFromHandler', () => {
    it('derives Booking from CreateBookingHandler', () => {
      expect(deriveEntityFromHandler('CreateBookingHandler')).toBe('Booking');
    });

    it('derives User from UpdateUserHandler', () => {
      expect(deriveEntityFromHandler('UpdateUserHandler')).toBe('User');
    });

    it('derives Coupon from DeleteCouponHandler', () => {
      expect(deriveEntityFromHandler('DeleteCouponHandler')).toBe('Coupon');
    });

    it('derives Employee from PatchEmployeeHandler', () => {
      expect(deriveEntityFromHandler('PatchEmployeeHandler')).toBe('Employee');
    });

    it('returns Unknown for unrecognized handler names', () => {
      expect(deriveEntityFromHandler('SomeHandler')).toBe('Unknown');
    });
  });

  describe('mapMethodToAction', () => {
    it('records POST as CREATE action', () => {
      expect(mapMethodToAction('POST')).toBe(ActivityAction.CREATE);
    });

    it('records PATCH as UPDATE action', () => {
      expect(mapMethodToAction('PATCH')).toBe(ActivityAction.UPDATE);
    });

    it('records PUT as UPDATE action', () => {
      expect(mapMethodToAction('PUT')).toBe(ActivityAction.UPDATE);
    });

    it('records DELETE as DELETE action', () => {
      expect(mapMethodToAction('DELETE')).toBe(ActivityAction.DELETE);
    });
  });

  it('skips GET requests', () => {
    const getCtx = makeCtx('GET', '/api/v1/dashboard/bookings');
    interceptor.intercept(getCtx, makeHandler({ id: 'entity-1' }));
    expect(prisma.activityLog.create).not.toHaveBeenCalled();
  });

  it('extracts userId from RequestContextStorage when available', (done) => {
    RequestContextStorage.run(
      { requestId: 'req-1', userId: 'ctx-user-1', ip: '1.2.3.4' },
      () => {
        const ctx = makeCtx('POST', '/api/v1/dashboard/bookings');
        interceptor.intercept(ctx, makeHandler({ id: 'booking-1' })).subscribe({
          next: () => {
            expect(prisma.activityLog.create).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({
                  userId: 'ctx-user-1',
                }),
              }),
            );
            done();
          },
        });
      },
    );
  });

  it('does not throw when Prisma fails', (done) => {
    prisma.activityLog.create.mockRejectedValueOnce(new Error('DB error'));
    const ctx = makeCtx('POST', '/api/v1/dashboard/bookings');
    interceptor.intercept(ctx, makeHandler({ id: 'entity-1' })).subscribe({
      next: (val) => {
        expect(val).toEqual({ id: 'entity-1' });
        done();
      },
    });
  });

  it('logs POST request with entity=Booking', (done) => {
    const ctx = makeCtx('POST', '/api/v1/dashboard/bookings');
    interceptor.intercept(ctx, makeHandler({ id: 'booking-123' })).subscribe({
      next: () => {
        expect(prisma.activityLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: ActivityAction.CREATE,
              entity: 'Booking',
              entityId: 'booking-123',
              description: expect.stringContaining('Booking'),
            }),
          }),
        );
        done();
      },
    });
  });

  it('logs DELETE request with entity=Coupon', (done) => {
    const deleteCtx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'DELETE',
          url: '/api/v1/dashboard/coupons/coup-1',
          originalUrl: '/api/v1/dashboard/coupons/coup-1',
          headers: {},
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
        }),
      }),
      getHandler: () => ({ name: 'DeleteCouponHandler' }),
      getClass: () => ({ name: 'DashboardFinanceController' }),
    } as unknown as ExecutionContext;
    interceptor.intercept(deleteCtx, makeHandler(null)).subscribe({
      next: () => {
        expect(prisma.activityLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: ActivityAction.DELETE,
              entity: 'Coupon',
            }),
          }),
        );
        done();
      },
    });
  });

  it('logs PATCH as UPDATE', (done) => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PATCH',
          url: '/api/v1/dashboard/users/user-1',
          originalUrl: '/api/v1/dashboard/users/user-1',
          headers: {},
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
        }),
      }),
      getHandler: () => ({ name: 'UpdateUserHandler' }),
      getClass: () => ({ name: 'DashboardIdentityController' }),
    } as unknown as ExecutionContext;
    interceptor.intercept(ctx, makeHandler({ id: 'user-1' })).subscribe({
      next: () => {
        expect(prisma.activityLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: ActivityAction.UPDATE,
              entity: 'User',
            }),
          }),
        );
        done();
      },
    });
  });

  it('includes metadata with httpMethod, path, handlerName', (done) => {
    const ctx = makeCtx('POST', '/api/v1/dashboard/bookings');
    interceptor.intercept(ctx, makeHandler({ id: 'booking-1' })).subscribe({
      next: () => {
        expect(prisma.activityLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              metadata: expect.objectContaining({
                httpMethod: 'POST',
                path: '/api/v1/dashboard/bookings',
                handlerName: 'CreateBookingHandler',
              }),
            }),
          }),
        );
        done();
      },
    });
  });

  it('does not break request flow when Prisma create throws', (done) => {
    prisma.activityLog.create.mockRejectedValueOnce(new Error('connection lost'));
    const ctx = makeCtx('POST', '/api/v1/dashboard/bookings');
    interceptor.intercept(ctx, makeHandler({ id: 'booking-1' })).subscribe({
      next: (val) => {
        expect(val).toEqual({ id: 'booking-1' });
        done();
      },
    });
  });
});

