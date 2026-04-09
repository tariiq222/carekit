import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotAdminController } from '../../../src/modules/chatbot/chatbot-admin.controller.js';
import { ChatbotKbController } from '../../../src/modules/chatbot/chatbot-kb.controller.js';
import { ChatbotService } from '../../../src/modules/chatbot/chatbot.service.js';
import { ChatbotConfigService } from '../../../src/modules/chatbot/chatbot-config.service.js';
import { ChatbotAnalyticsService } from '../../../src/modules/chatbot/chatbot-analytics.service.js';
import { ChatbotRagService } from '../../../src/modules/chatbot/chatbot-rag.service.js';
import { ChatbotFileService } from '../../../src/modules/chatbot/chatbot-file.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

jest.mock('../../../src/common/helpers/file-validation.helper.js', () => ({
  validateFileContent: jest.fn(),
}));

// ─────────────────────────────────────────────
//  ChatbotAdminController
// ─────────────────────────────────────────────

const mockChatbotService = {
  sendStaffMessage: jest.fn(),
};

const mockConfigService = {
  getAll: jest.fn(),
  getByCategory: jest.fn(),
  bulkUpsert: jest.fn(),
  seedDefaults: jest.fn(),
};

const mockAnalyticsService = {
  getSessionStats: jest.fn(),
  getMostAskedQuestions: jest.fn(),
};

const staffUser = { id: 'staff-1' };

describe('ChatbotAdminController', () => {
  let controller: ChatbotAdminController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatbotAdminController],
      providers: [
        { provide: ChatbotService, useValue: mockChatbotService },
        { provide: ChatbotConfigService, useValue: mockConfigService },
        { provide: ChatbotAnalyticsService, useValue: mockAnalyticsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ChatbotAdminController>(ChatbotAdminController);
  });

  describe('getConfig', () => {
    it('should delegate to configService.getAll()', async () => {
      const configs = [{ key: 'greeting', value: 'Hello' }];
      mockConfigService.getAll.mockResolvedValue(configs);

      expect(await controller.getConfig()).toEqual(configs);
      expect(mockConfigService.getAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('getConfigByCategory', () => {
    it('should delegate to configService.getByCategory() with category param', async () => {
      const result = [{ key: 'tone', value: 'formal' }];
      mockConfigService.getByCategory.mockResolvedValue(result);

      expect(await controller.getConfigByCategory('general')).toEqual(result);
      expect(mockConfigService.getByCategory).toHaveBeenCalledWith('general');
    });
  });

  describe('updateConfig', () => {
    it('should pass dto.configs to configService.bulkUpsert()', async () => {
      const dto = { configs: [{ key: 'greeting', value: 'Hi', category: 'general' }] } as any;
      const updated = [{ id: 'cfg-1' }];
      mockConfigService.bulkUpsert.mockResolvedValue(updated);

      expect(await controller.updateConfig(dto)).toEqual(updated);
      expect(mockConfigService.bulkUpsert).toHaveBeenCalledWith(dto.configs);
    });
  });

  describe('seedDefaults', () => {
    it('should call configService.seedDefaults() and return { seeded: count }', async () => {
      mockConfigService.seedDefaults.mockResolvedValue(12);

      expect(await controller.seedDefaults()).toEqual({ seeded: 12 });
      expect(mockConfigService.seedDefaults).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAnalytics', () => {
    it('should delegate with from and to when provided', async () => {
      const stats = { totalSessions: 100, avgDuration: 5 };
      mockAnalyticsService.getSessionStats.mockResolvedValue(stats);

      const result = await controller.getAnalytics('2024-01-01', '2024-01-31');

      expect(result).toEqual(stats);
      expect(mockAnalyticsService.getSessionStats).toHaveBeenCalledWith({
        from: '2024-01-01',
        to: '2024-01-31',
      });
    });

    it('should delegate with undefined from/to when not provided', async () => {
      const stats = { totalSessions: 50 };
      mockAnalyticsService.getSessionStats.mockResolvedValue(stats);

      await controller.getAnalytics();

      expect(mockAnalyticsService.getSessionStats).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
      });
    });
  });

  describe('getMostAskedQuestions', () => {
    it('should parse limit string and pass to analyticsService', async () => {
      const questions = [{ question: 'ما هي المواعيد؟', count: 50 }];
      mockAnalyticsService.getMostAskedQuestions.mockResolvedValue(questions);

      expect(await controller.getMostAskedQuestions('5')).toEqual(questions);
      expect(mockAnalyticsService.getMostAskedQuestions).toHaveBeenCalledWith(5);
    });

    it('should default limit to 10 when not provided', async () => {
      mockAnalyticsService.getMostAskedQuestions.mockResolvedValue([]);

      await controller.getMostAskedQuestions();

      expect(mockAnalyticsService.getMostAskedQuestions).toHaveBeenCalledWith(10);
    });
  });

  describe('sendStaffMessage', () => {
    it('should call chatbotService.sendStaffMessage and return { success: true, data }', async () => {
      const dto = { content: 'سأتحقق من الأمر.' } as any;
      const data = { id: 'msg-1', content: dto.content };
      mockChatbotService.sendStaffMessage.mockResolvedValue(data);

      const result = await controller.sendStaffMessage('sess-42', dto, staffUser);

      expect(result).toEqual({ success: true, data });
      expect(mockChatbotService.sendStaffMessage).toHaveBeenCalledWith(
        'sess-42',
        'staff-1',
        'سأتحقق من الأمر.',
      );
    });
  });
});

// ─────────────────────────────────────────────
//  ChatbotKbController
// ─────────────────────────────────────────────

const mockRagService = {
  findAll: jest.fn(),
  upsertEntry: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  syncFromDatabase: jest.fn(),
};

const mockFileService = {
  uploadFile: jest.fn(),
  listFiles: jest.fn(),
  processFile: jest.fn(),
  deleteFile: jest.fn(),
};

const adminUser = { id: 'admin-1' };
const kbEntryId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const fileId = 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj';

describe('ChatbotKbController', () => {
  let controller: ChatbotKbController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatbotKbController],
      providers: [
        { provide: ChatbotRagService, useValue: mockRagService },
        { provide: ChatbotFileService, useValue: mockFileService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ChatbotKbController>(ChatbotKbController);
  });

  describe('listKnowledgeBase', () => {
    it('should parse page/perPage and pass source/category to ragService.findAll()', async () => {
      const result = { data: [], total: 0 };
      mockRagService.findAll.mockResolvedValue(result);

      expect(await controller.listKnowledgeBase('2', '15', 'manual', 'procedures')).toEqual(result);
      expect(mockRagService.findAll).toHaveBeenCalledWith({
        page: 2,
        perPage: 15,
        source: 'manual',
        category: 'procedures',
      });
    });

    it('should default page to 1 and perPage to 20 when not provided', async () => {
      mockRagService.findAll.mockResolvedValue({ data: [] });

      await controller.listKnowledgeBase();

      expect(mockRagService.findAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 20,
        source: undefined,
        category: undefined,
      });
    });
  });

  describe('createKbEntry', () => {
    it('should call ragService.upsertEntry with source forced to manual', async () => {
      const dto = { title: 'رسوم الكشف', content: 'تكلف 200 ريال', category: 'pricing' } as any;
      const entry = { id: 'kb-1' };
      mockRagService.upsertEntry.mockResolvedValue(entry);

      expect(await controller.createKbEntry(dto)).toEqual(entry);
      expect(mockRagService.upsertEntry).toHaveBeenCalledWith({
        title: 'رسوم الكشف',
        content: 'تكلف 200 ريال',
        category: 'pricing',
        source: 'manual',
      });
    });
  });

  describe('updateKbEntry', () => {
    it('should delegate to ragService.update() with id and dto', async () => {
      const dto = { content: 'محتوى محدّث' } as any;
      const updated = { id: kbEntryId };
      mockRagService.update.mockResolvedValue(updated);

      expect(await controller.updateKbEntry(kbEntryId, dto)).toEqual(updated);
      expect(mockRagService.update).toHaveBeenCalledWith(kbEntryId, dto);
    });
  });

  describe('deleteKbEntry', () => {
    it('should delegate to ragService.delete() with id', async () => {
      mockRagService.delete.mockResolvedValue(undefined);

      await controller.deleteKbEntry(kbEntryId);

      expect(mockRagService.delete).toHaveBeenCalledWith(kbEntryId);
    });
  });

  describe('syncKnowledgeBase', () => {
    it('should call ragService.syncFromDatabase() and return { synced: count }', async () => {
      mockRagService.syncFromDatabase.mockResolvedValue(42);

      expect(await controller.syncKnowledgeBase()).toEqual({ synced: 42 });
      expect(mockRagService.syncFromDatabase).toHaveBeenCalledTimes(1);
    });
  });

  describe('uploadFile', () => {
    it('should call fileService.uploadFile() when req.file is present', async () => {
      const file = { originalname: 'guide.pdf', mimetype: 'application/pdf', buffer: Buffer.from('data') } as any;
      const req = { file } as any;
      const uploaded = { id: 'file-1' };
      mockFileService.uploadFile.mockResolvedValue(uploaded);

      expect(await controller.uploadFile(adminUser, req)).toEqual(uploaded);
      expect(mockFileService.uploadFile).toHaveBeenCalledWith('admin-1', file);
    });

    it('should throw BadRequestException when req.file is missing', async () => {
      const req = { file: undefined } as any;

      await expect(controller.uploadFile(adminUser, req)).rejects.toThrow(BadRequestException);
      expect(mockFileService.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('listFiles', () => {
    it('should parse page/perPage and delegate to fileService.listFiles()', async () => {
      const result = { data: [], total: 0 };
      mockFileService.listFiles.mockResolvedValue(result);

      expect(await controller.listFiles('3', '5')).toEqual(result);
      expect(mockFileService.listFiles).toHaveBeenCalledWith({ page: 3, perPage: 5 });
    });

    it('should default page to 1 and perPage to 20 when not provided', async () => {
      mockFileService.listFiles.mockResolvedValue({ data: [] });

      await controller.listFiles();

      expect(mockFileService.listFiles).toHaveBeenCalledWith({ page: 1, perPage: 20 });
    });
  });

  describe('processFile', () => {
    it('should call fileService.processFile() and return { processed: true }', async () => {
      mockFileService.processFile.mockResolvedValue(undefined);

      expect(await controller.processFile(fileId)).toEqual({ processed: true });
      expect(mockFileService.processFile).toHaveBeenCalledWith(fileId);
    });
  });

  describe('deleteFile', () => {
    it('should call fileService.deleteFile() and return { deleted: true }', async () => {
      mockFileService.deleteFile.mockResolvedValue(undefined);

      expect(await controller.deleteFile(fileId)).toEqual({ deleted: true });
      expect(mockFileService.deleteFile).toHaveBeenCalledWith(fileId);
    });
  });
});
