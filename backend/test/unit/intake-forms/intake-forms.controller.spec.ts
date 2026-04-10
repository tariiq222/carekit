import { Test, TestingModule } from '@nestjs/testing';
import { IntakeFormsController } from '../../../src/modules/intake-forms/intake-forms.controller.js';
import { IntakeFormsService } from '../../../src/modules/intake-forms/intake-forms.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../../src/common/guards/feature-flag.guard.js';

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
      .overrideGuard(FeatureFlagGuard)
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
    it('should merge formId into dto and pass patientId from @CurrentUser', async () => {
      const dto = { answers: [{ fieldId: 'fld1', value: 'Yes' }] } as any;
      const result = { id: 'resp-1' };
      mockService.submitResponse.mockResolvedValue(result);

      expect(await controller.submitResponse('f1', 'patient-1', dto)).toEqual(result);
      expect(mockService.submitResponse).toHaveBeenCalledWith('patient-1', {
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
