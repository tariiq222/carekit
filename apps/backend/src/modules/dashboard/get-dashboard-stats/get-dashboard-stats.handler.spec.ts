import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../../infrastructure/database";
import { TenantContextService } from "../../../common/tenant/tenant-context.service";
import { GetDashboardStatsHandler } from "./get-dashboard-stats.handler";
import { BookingStatus, PaymentStatus, PaymentMethod } from "@prisma/client";

const ORG_ID = "org-test-123";

const buildPrisma = () => ({
  booking: {
    count: jest.fn(),
  },
  payment: {
    count: jest.fn(),
    aggregate: jest.fn(),
  },
});

const buildTenant = () => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(ORG_ID),
});

describe("GetDashboardStatsHandler", () => {
  let handler: GetDashboardStatsHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let tenant: ReturnType<typeof buildTenant>;

  beforeEach(async () => {
    prisma = buildPrisma();
    tenant = buildTenant();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetDashboardStatsHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantContextService, useValue: tenant },
      ],
    }).compile();

    handler = module.get<GetDashboardStatsHandler>(GetDashboardStatsHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("execute", () => {
    it("calls all Prisma counts with correct organizationId and today date range", async () => {
      prisma.booking.count.mockResolvedValue(0);
      prisma.payment.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });

      await handler.execute();

      expect(prisma.booking.count).toHaveBeenCalledTimes(4);
      // todayBookings
      expect(prisma.booking.count).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            scheduledAt: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        }),
      );
      // confirmedToday
      expect(prisma.booking.count).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            status: BookingStatus.CONFIRMED,
          }),
        }),
      );
      // pendingToday
      expect(prisma.booking.count).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            status: BookingStatus.PENDING,
          }),
        }),
      );
      // cancelRequests
      expect(prisma.booking.count).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            status: BookingStatus.CANCEL_REQUESTED,
          }),
        }),
      );
      expect(prisma.payment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            method: PaymentMethod.BANK_TRANSFER,
            status: PaymentStatus.PENDING_VERIFICATION,
          }),
        }),
      );
      expect(prisma.payment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PaymentStatus.COMPLETED,
            processedAt: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it("returns all six stat fields", async () => {
      prisma.booking.count
        .mockResolvedValueOnce(5) // todayBookings
        .mockResolvedValueOnce(2) // confirmedToday
        .mockResolvedValueOnce(3) // pendingToday
        .mockResolvedValueOnce(1); // cancelRequests
      prisma.payment.count.mockResolvedValue(4); // pendingPayments
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: { toString: () => "1500.00" } },
      });

      const result = await handler.execute();

      expect(result).toEqual({
        todayBookings: 5,
        confirmedToday: 2,
        pendingToday: 3,
        cancelRequests: 1,
        pendingPayments: 4,
        todayRevenue: 1500.0,
      });
    });

    it("handles null revenue sum as zero", async () => {
      prisma.booking.count.mockResolvedValue(0);
      prisma.payment.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });

      const result = await handler.execute();

      expect(result.todayRevenue).toBe(0);
    });

    it("requires organizationId from tenant context", async () => {
      prisma.booking.count.mockResolvedValue(0);
      prisma.payment.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });

      await handler.execute();

      expect(tenant.requireOrganizationIdOrDefault).toHaveBeenCalled();
    });
  });
});
