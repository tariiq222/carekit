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
      expect(mockService.preview).toHaveBeenCalledWith(
        'welcome',
        { name: 'Ahmed' },
        'ar',
      );
    });
  });
});
