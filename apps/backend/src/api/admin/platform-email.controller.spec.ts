import { PlatformEmailController, PlatformEmailLogStatus } from './platform-email.controller';
import { ListPlatformEmailTemplatesHandler } from '../../modules/platform/email/list-platform-email-templates/list-platform-email-templates.handler';
import { GetPlatformEmailTemplateHandler } from '../../modules/platform/email/get-platform-email-template/get-platform-email-template.handler';
import { UpdatePlatformEmailTemplateHandler } from '../../modules/platform/email/update-platform-email-template/update-platform-email-template.handler';
import { UpdatePlatformEmailTemplateDto } from '../../modules/platform/email/update-platform-email-template/update-platform-email-template.dto';
import { PreviewPlatformEmailTemplateHandler } from '../../modules/platform/email/preview-platform-email-template/preview-platform-email-template.handler';
import { SendTestEmailHandler } from '../../modules/platform/email/send-test-email/send-test-email.handler';
import { ListPlatformEmailLogsHandler, ListPlatformEmailLogsQuery } from '../../modules/platform/email/list-platform-email-logs/list-platform-email-logs.handler';
import type { Request } from 'express';

describe('PlatformEmailController', () => {
  let controller: PlatformEmailController;
  let mockHandlers: {
    listTemplates: Partial<ListPlatformEmailTemplatesHandler>;
    getTemplate: Partial<GetPlatformEmailTemplateHandler>;
    updateTemplate: Partial<UpdatePlatformEmailTemplateHandler>;
    previewTemplate: Partial<PreviewPlatformEmailTemplateHandler>;
    sendTest: Partial<SendTestEmailHandler>;
    listLogs: Partial<ListPlatformEmailLogsHandler>;
  };

  beforeEach(() => {
    mockHandlers = {
      listTemplates: { execute: jest.fn() },
      getTemplate: { execute: jest.fn() },
      updateTemplate: { execute: jest.fn() },
      previewTemplate: { execute: jest.fn() },
      sendTest: { execute: jest.fn() },
      listLogs: { execute: jest.fn() },
    };
    controller = new PlatformEmailController(
      mockHandlers.listTemplates as ListPlatformEmailTemplatesHandler,
      mockHandlers.getTemplate as GetPlatformEmailTemplateHandler,
      mockHandlers.updateTemplate as UpdatePlatformEmailTemplateHandler,
      mockHandlers.previewTemplate as PreviewPlatformEmailTemplateHandler,
      mockHandlers.sendTest as SendTestEmailHandler,
      mockHandlers.listLogs as ListPlatformEmailLogsHandler,
    );
  });

  describe('list', () => {
    it('calls listTemplates.execute', () => {
      (mockHandlers.listTemplates.execute as jest.Mock).mockResolvedValue([{ slug: 'welcome' }]);

      controller.list();

      expect(mockHandlers.listTemplates.execute).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('calls getTemplate.execute with slug', () => {
      (mockHandlers.getTemplate.execute as jest.Mock).mockResolvedValue({ slug: 'welcome' });

      controller.get('welcome');

      expect(mockHandlers.getTemplate.execute).toHaveBeenCalledWith('welcome');
    });
  });

  describe('preview', () => {
    it('calls previewTemplate.execute with slug and vars', () => {
      (mockHandlers.previewTemplate.execute as jest.Mock).mockResolvedValue({ html: '<p>Hello</p>' });

      controller.preview('welcome', { vars: { name: 'John' } });

      expect(mockHandlers.previewTemplate.execute).toHaveBeenCalledWith('welcome', { name: 'John' });
    });

    it('passes empty vars when not provided', () => {
      (mockHandlers.previewTemplate.execute as jest.Mock).mockResolvedValue({ html: '<p>Hello</p>' });

      controller.preview('welcome', {});

      expect(mockHandlers.previewTemplate.execute).toHaveBeenCalledWith('welcome', {});
    });
  });

  describe('logs', () => {
    it('builds query with status when provided', () => {
      (mockHandlers.listLogs.execute as jest.Mock).mockResolvedValue({ logs: [] });

      controller.logs('SENT');

      expect(mockHandlers.listLogs.execute).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SENT' }),
      );
    });

    it('builds query with templateSlug when provided', () => {
      (mockHandlers.listLogs.execute as jest.Mock).mockResolvedValue({ logs: [] });

      controller.logs(undefined, 'welcome');

      expect(mockHandlers.listLogs.execute).toHaveBeenCalledWith(
        expect.objectContaining({ templateSlug: 'welcome' }),
      );
    });

    it('builds query with organizationId when provided', () => {
      (mockHandlers.listLogs.execute as jest.Mock).mockResolvedValue({ logs: [] });

      controller.logs(undefined, undefined, 'org-1');

      expect(mockHandlers.listLogs.execute).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
      );
    });

    it('builds query with cursor when provided', () => {
      (mockHandlers.listLogs.execute as jest.Mock).mockResolvedValue({ logs: [] });

      controller.logs(undefined, undefined, undefined, 'cursor-123');

      expect(mockHandlers.listLogs.execute).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'cursor-123' }),
      );
    });

    it('builds query with limit when provided', () => {
      (mockHandlers.listLogs.execute as jest.Mock).mockResolvedValue({ logs: [] });

      controller.logs(undefined, undefined, undefined, undefined, '50');

      expect(mockHandlers.listLogs.execute).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });

    it('builds empty query when no params provided', () => {
      (mockHandlers.listLogs.execute as jest.Mock).mockResolvedValue({ logs: [] });

      controller.logs();

      expect(mockHandlers.listLogs.execute).toHaveBeenCalledWith({});
    });

    it('builds query with all params', () => {
      (mockHandlers.listLogs.execute as jest.Mock).mockResolvedValue({ logs: [] });

      controller.logs('FAILED', 'welcome', 'org-1', 'cursor-123', '25');

      expect(mockHandlers.listLogs.execute).toHaveBeenCalledWith({
        status: 'FAILED',
        templateSlug: 'welcome',
        organizationId: 'org-1',
        cursor: 'cursor-123',
        limit: 25,
      });
    });
  });
});
