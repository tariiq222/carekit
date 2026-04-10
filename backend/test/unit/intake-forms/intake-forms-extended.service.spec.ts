import { Test, TestingModule } from '@nestjs/testing';
import { IntakeFormsService } from '../../../src/modules/intake-forms/intake-forms.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const mockTx = {
  intakeField: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  intakeForm: { update: jest.fn() },
};

const mockPrisma = {
  intakeForm: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  intakeField: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  intakeResponse: { create: jest.fn(), findMany: jest.fn() },
  booking: { findUnique: jest.fn() },
  service: { findFirst: jest.fn() },
  practitioner: { findFirst: jest.fn() },
  branch: { findFirst: jest.fn() },
  $transaction: jest.fn(),
};

describe('IntakeFormsService — extended coverage', () => {
  let service: IntakeFormsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntakeFormsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<IntakeFormsService>(IntakeFormsService);
  });

  // ─── listForms ────────────────────────────────────────────────

  describe('listForms', () => {
    it('should return all forms without filters', async () => {
      const forms = [
        { id: 'form-1', scope: 'global' },
        { id: 'form-2', scope: 'service' },
      ];
      mockPrisma.intakeForm.findMany.mockResolvedValue(forms);

      const result = await service.listForms({});

      expect(result).toEqual(forms);
      expect(mockPrisma.intakeForm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should filter by scope when provided', async () => {
      mockPrisma.intakeForm.findMany.mockResolvedValue([]);

      await service.listForms({ scope: 'global' } as Parameters<
        typeof service.listForms
      >[0]);

      expect(mockPrisma.intakeForm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ scope: 'global' }),
        }),
      );
    });

    it('should filter by isActive=false when provided', async () => {
      mockPrisma.intakeForm.findMany.mockResolvedValue([]);

      await service.listForms({ isActive: false } as Parameters<
        typeof service.listForms
      >[0]);

      expect(mockPrisma.intakeForm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('should filter by serviceId when provided', async () => {
      mockPrisma.intakeForm.findMany.mockResolvedValue([]);

      await service.listForms({ serviceId: 'svc-1' } as Parameters<
        typeof service.listForms
      >[0]);

      expect(mockPrisma.intakeForm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ serviceId: 'svc-1' }),
        }),
      );
    });

    it('should not include isActive in where when isActive is undefined', async () => {
      mockPrisma.intakeForm.findMany.mockResolvedValue([]);

      await service.listForms({});

      const call = mockPrisma.intakeForm.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).not.toHaveProperty('isActive');
    });

    it('should filter by practitionerId when provided', async () => {
      mockPrisma.intakeForm.findMany.mockResolvedValue([]);

      await service.listForms({ practitionerId: 'prac-1' } as Parameters<
        typeof service.listForms
      >[0]);

      expect(mockPrisma.intakeForm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ practitionerId: 'prac-1' }),
        }),
      );
    });

    it('should filter by branchId when provided', async () => {
      mockPrisma.intakeForm.findMany.mockResolvedValue([]);

      await service.listForms({ branchId: 'branch-1' } as Parameters<
        typeof service.listForms
      >[0]);

      expect(mockPrisma.intakeForm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: 'branch-1' }),
        }),
      );
    });
  });

  // ─── setFields — edge cases ───────────────────────────────────

  describe('setFields — options, condition, sortOrder', () => {
    it('should auto-assign sortOrder from index when not provided', async () => {
      mockPrisma.intakeForm.findUnique.mockResolvedValue({ id: 'form-1' });
      mockPrisma.$transaction.mockImplementation(
        (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
      );
      mockTx.intakeField.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.intakeField.createMany.mockResolvedValue({ count: 2 });
      mockTx.intakeForm.update.mockResolvedValue({});
      mockTx.intakeField.findMany.mockResolvedValue([]);

      await service.setFields('form-1', {
        fields: [
          { labelAr: 'أول', labelEn: 'First', fieldType: 'text' },
          { labelAr: 'ثاني', labelEn: 'Second', fieldType: 'number' },
        ],
      } as Parameters<typeof service.setFields>[1]);

      expect(mockTx.intakeField.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ sortOrder: 0 }),
            expect.objectContaining({ sortOrder: 1 }),
          ]),
        }),
      );
    });

    it('should store options array for select fields', async () => {
      mockPrisma.intakeForm.findUnique.mockResolvedValue({ id: 'form-1' });
      mockPrisma.$transaction.mockImplementation(
        (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
      );
      mockTx.intakeField.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.intakeField.createMany.mockResolvedValue({ count: 1 });
      mockTx.intakeForm.update.mockResolvedValue({});
      mockTx.intakeField.findMany.mockResolvedValue([]);

      await service.setFields('form-1', {
        fields: [
          {
            labelAr: 'تخصص',
            labelEn: 'Specialty',
            fieldType: 'select',
            options: ['A', 'B', 'C'],
          },
        ],
      } as Parameters<typeof service.setFields>[1]);

      expect(mockTx.intakeField.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ options: ['A', 'B', 'C'] }),
          ]),
        }),
      );
    });

    it('should store condition object for conditional fields', async () => {
      const condition = {
        fieldId: 'field-ref',
        operator: 'equals',
        value: 'yes',
      };
      mockPrisma.intakeForm.findUnique.mockResolvedValue({ id: 'form-1' });
      mockPrisma.$transaction.mockImplementation(
        (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
      );
      mockTx.intakeField.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.intakeField.createMany.mockResolvedValue({ count: 1 });
      mockTx.intakeForm.update.mockResolvedValue({});
      mockTx.intakeField.findMany.mockResolvedValue([]);

      await service.setFields('form-1', {
        fields: [
          {
            labelAr: 'تفاصيل',
            labelEn: 'Details',
            fieldType: 'textarea',
            condition,
          },
        ],
      } as Parameters<typeof service.setFields>[1]);

      expect(mockTx.intakeField.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ condition }),
          ]),
        }),
      );
    });

    it('should use provided sortOrder when explicitly set', async () => {
      mockPrisma.intakeForm.findUnique.mockResolvedValue({ id: 'form-1' });
      mockPrisma.$transaction.mockImplementation(
        (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
      );
      mockTx.intakeField.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.intakeField.createMany.mockResolvedValue({ count: 1 });
      mockTx.intakeForm.update.mockResolvedValue({});
      mockTx.intakeField.findMany.mockResolvedValue([]);

      await service.setFields('form-1', {
        fields: [
          {
            labelAr: 'ثالث',
            labelEn: 'Third',
            fieldType: 'text',
            sortOrder: 5,
          },
        ],
      } as Parameters<typeof service.setFields>[1]);

      expect(mockTx.intakeField.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ sortOrder: 5 }),
          ]),
        }),
      );
    });
  });

  // ─── submitResponse — patientId & return value ────────────────

  describe('submitResponse — return value', () => {
    it('should return only the response (not the form update)', async () => {
      const mockResponse = {
        id: 'resp-1',
        formId: 'form-1',
        patientId: 'p-1',
        answers: {},
      };
      mockPrisma.intakeForm.findUnique.mockResolvedValue({ id: 'form-1' });
      mockPrisma.booking.findUnique.mockResolvedValue({ patientId: 'p-1' });
      mockPrisma.$transaction.mockResolvedValue([
        mockResponse,
        { id: 'form-1', submissionsCount: 2 },
      ]);

      const result = await service.submitResponse('p-1', {
        formId: 'form-1',
        bookingId: 'booking-1',
        answers: {},
      });

      expect(result).toEqual(mockResponse);
      expect(result).not.toHaveProperty('submissionsCount');
    });

    it('should use $transaction for atomic create + counter increment', async () => {
      mockPrisma.intakeForm.findUnique.mockResolvedValue({ id: 'form-1' });
      mockPrisma.booking.findUnique.mockResolvedValue({ patientId: 'p-1' });
      mockPrisma.$transaction.mockResolvedValue([{ id: 'resp-1' }, {}]);

      await service.submitResponse('p-1', {
        formId: 'form-1',
        bookingId: 'booking-1',
        answers: {},
      });

      // $transaction is called with an array (parallel mode), not a callback
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  // ─── validateScopeTarget — skip when ID absent ────────────────

  describe('validateScopeTarget — skip when FK not provided', () => {
    it('should skip service lookup when scope=service but serviceId is undefined', async () => {
      const dto = {
        scope: 'service',
        nameAr: 'ن',
        nameEn: 'N',
        type: 'pre_booking',
      } as Parameters<typeof service.createForm>[0];
      mockPrisma.intakeForm.create.mockResolvedValue({
        id: 'f1',
        ...dto,
        isActive: true,
        fields: [],
      });

      await service.createForm(dto);

      expect(mockPrisma.service.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.intakeForm.create).toHaveBeenCalled();
    });

    it('should skip practitioner lookup when scope=practitioner but practitionerId is undefined', async () => {
      const dto = {
        scope: 'practitioner',
        nameAr: 'ن',
        nameEn: 'N',
        type: 'pre_booking',
      } as Parameters<typeof service.createForm>[0];
      mockPrisma.intakeForm.create.mockResolvedValue({
        id: 'f1',
        ...dto,
        isActive: true,
        fields: [],
      });

      await service.createForm(dto);

      expect(mockPrisma.practitioner.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.intakeForm.create).toHaveBeenCalled();
    });

    it('should skip branch lookup when scope=branch but branchId is undefined', async () => {
      const dto = {
        scope: 'branch',
        nameAr: 'ن',
        nameEn: 'N',
        type: 'pre_booking',
      } as Parameters<typeof service.createForm>[0];
      mockPrisma.intakeForm.create.mockResolvedValue({
        id: 'f1',
        ...dto,
        isActive: true,
        fields: [],
      });

      await service.createForm(dto);

      expect(mockPrisma.branch.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.intakeForm.create).toHaveBeenCalled();
    });
  });
});
