import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IntakeFormsService } from '../../../src/modules/intake-forms/intake-forms.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const mockTx = {
  intakeField: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  intakeForm: { update: jest.fn() },
};

const mockPrisma = {
  intakeForm: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  intakeField: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  intakeResponse: { create: jest.fn(), findMany: jest.fn() },
  service: { findFirst: jest.fn() },
  practitioner: { findFirst: jest.fn() },
  branch: { findFirst: jest.fn() },
  $transaction: jest.fn(),
};

describe('IntakeFormsService', () => {
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

  describe('getForm', () => {
    it('should return form with fields when form exists', async () => {
      const form = { id: 'form-1', nameAr: 'نموذج', nameEn: 'Form', fields: [] };
      mockPrisma.intakeForm.findUnique.mockResolvedValue(form);

      const result = await service.getForm('form-1');

      expect(result).toEqual(form);
      expect(mockPrisma.intakeForm.findUnique).toHaveBeenCalledWith({
        where: { id: 'form-1' },
        include: { fields: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    it('should throw NotFoundException when form not found', async () => {
      mockPrisma.intakeForm.findUnique.mockResolvedValue(null);

      await expect(service.getForm('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createForm', () => {
    it('should create form with isActive default true when not provided', async () => {
      const dto = { nameAr: 'نموذج', nameEn: 'Form', type: 'GENERAL', scope: 'global' };
      const created = { id: 'form-1', ...dto, isActive: true, fields: [] };
      mockPrisma.intakeForm.create.mockResolvedValue(created);

      const result = await service.createForm(dto);

      expect(result).toEqual(created);
      expect(mockPrisma.intakeForm.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('should throw NotFoundException when scope=service and service not found', async () => {
      const dto = { scope: 'service', serviceId: 'svc-1', nameAr: 'ن', nameEn: 'N', type: 'GENERAL' };
      mockPrisma.service.findFirst.mockResolvedValue(null);

      await expect(service.createForm(dto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.intakeForm.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when scope=practitioner and practitioner not found', async () => {
      const dto = { scope: 'practitioner', practitionerId: 'prac-1', nameAr: 'ن', nameEn: 'N', type: 'GENERAL' };
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.createForm(dto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.intakeForm.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when scope=branch and branch not found', async () => {
      const dto = { scope: 'branch', branchId: 'branch-1', nameAr: 'ن', nameEn: 'N', type: 'GENERAL' };
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.createForm(dto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.intakeForm.create).not.toHaveBeenCalled();
    });

    it('should not validate scope target when scope=global', async () => {
      const dto = { scope: 'global', nameAr: 'ن', nameEn: 'N', type: 'GENERAL' };
      const created = { id: 'form-1', ...dto, isActive: true, fields: [] };
      mockPrisma.intakeForm.create.mockResolvedValue(created);

      await service.createForm(dto);

      expect(mockPrisma.service.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.practitioner.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.branch.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.intakeForm.create).toHaveBeenCalled();
    });
  });

  describe('updateForm', () => {
    it('should throw NotFoundException when form not found', async () => {
      mockPrisma.intakeForm.findUnique.mockResolvedValue(null);

      await expect(service.updateForm('missing', { nameAr: 'x' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.intakeForm.update).not.toHaveBeenCalled();
    });

    it('should update only provided fields', async () => {
      const existing = { id: 'form-1', nameAr: 'قديم', isActive: true };
      const updated = { id: 'form-1', nameAr: 'جديد', isActive: true, fields: [] };
      mockPrisma.intakeForm.findUnique.mockResolvedValue(existing);
      mockPrisma.intakeForm.update.mockResolvedValue(updated);

      const result = await service.updateForm('form-1', { nameAr: 'جديد' });

      expect(result).toEqual(updated);
      expect(mockPrisma.intakeForm.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { nameAr: 'جديد' } }),
      );
    });
  });

  describe('deleteForm', () => {
    it('should delete form and return {deleted: true}', async () => {
      const existing = { id: 'form-1' };
      mockPrisma.intakeForm.findUnique.mockResolvedValue(existing);
      mockPrisma.intakeForm.delete.mockResolvedValue(existing);

      const result = await service.deleteForm('form-1');

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.intakeForm.delete).toHaveBeenCalledWith({ where: { id: 'form-1' } });
    });

    it('should throw NotFoundException when form not found', async () => {
      mockPrisma.intakeForm.findUnique.mockResolvedValue(null);

      await expect(service.deleteForm('missing')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.intakeForm.delete).not.toHaveBeenCalled();
    });
  });

  describe('setFields', () => {
    it('should replace all fields atomically when fields provided', async () => {
      const existing = { id: 'form-1' };
      const fields = [{ labelAr: 'اسم', labelEn: 'Name', fieldType: 'TEXT', isRequired: true, sortOrder: 0, formId: 'form-1' }];
      mockPrisma.intakeForm.findUnique.mockResolvedValue(existing);
      mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
      mockTx.intakeField.deleteMany.mockResolvedValue({ count: 2 });
      mockTx.intakeField.createMany.mockResolvedValue({ count: 1 });
      mockTx.intakeForm.update.mockResolvedValue(existing);
      mockTx.intakeField.findMany.mockResolvedValue(fields);

      const result = await service.setFields('form-1', { fields: [{ labelAr: 'اسم', labelEn: 'Name', fieldType: 'TEXT' }] });

      expect(result).toEqual(fields);
      expect(mockTx.intakeField.deleteMany).toHaveBeenCalledWith({ where: { formId: 'form-1' } });
      expect(mockTx.intakeField.createMany).toHaveBeenCalled();
    });

    it('should return empty array when fields is empty', async () => {
      const existing = { id: 'form-1' };
      mockPrisma.intakeForm.findUnique.mockResolvedValue(existing);
      mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
      mockTx.intakeField.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.setFields('form-1', { fields: [] });

      expect(result).toEqual([]);
      expect(mockTx.intakeField.createMany).not.toHaveBeenCalled();
    });
  });

  describe('submitResponse', () => {
    it('should create response and increment submissionsCount', async () => {
      const existing = { id: 'form-1' };
      const mockResponse = { id: 'resp-1', formId: 'form-1', patientId: 'patient-1', answers: {} };
      mockPrisma.intakeForm.findUnique.mockResolvedValue(existing);
      mockPrisma.$transaction.mockResolvedValue([mockResponse, {}]);

      const result = await service.submitResponse('patient-1', { formId: 'form-1', bookingId: 'booking-1', answers: {} });

      expect(result).toEqual(mockResponse);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when form not found', async () => {
      mockPrisma.intakeForm.findUnique.mockResolvedValue(null);

      await expect(
        service.submitResponse('patient-1', { formId: 'missing', bookingId: 'booking-1', answers: {} }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getResponseByBooking', () => {
    it('should return responses for a booking', async () => {
      const responses = [{ id: 'resp-1', bookingId: 'booking-1', form: { fields: [] } }];
      mockPrisma.intakeResponse.findMany.mockResolvedValue(responses);

      const result = await service.getResponseByBooking('booking-1');

      expect(result).toEqual(responses);
      expect(mockPrisma.intakeResponse.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        include: { form: { include: { fields: { orderBy: { sortOrder: 'asc' } } } } },
      });
    });
  });
});
