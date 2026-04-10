import { Test, TestingModule } from '@nestjs/testing';
import { Subject } from 'rxjs';
import { ChatbotController } from '../../../src/modules/chatbot/chatbot.controller.js';
import { ChatbotService } from '../../../src/modules/chatbot/chatbot.service.js';
import { ChatbotStreamService } from '../../../src/modules/chatbot/chatbot-stream.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../../src/common/guards/feature-flag.guard.js';

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
const patientUser = { id: 'patient-1', roles: [{ slug: 'patient' }] };

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
      .overrideGuard(FeatureFlagGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ChatbotController>(ChatbotController);
  });

  describe('createSession', () => {
    it('should pass userId and language', async () => {
      const dto = { language: 'ar' } as any;
      const session = { id: 'sess-1' };
      mockChatbotService.createSession.mockResolvedValue(session);

      expect(await controller.createSession(dto, patientUser)).toEqual(session);
      expect(mockChatbotService.createSession).toHaveBeenCalledWith('patient-1', 'ar');
    });
  });

  describe('listSessions', () => {
    it('should pass userId for non-admin users', async () => {
      const query = { page: '2', perPage: '10' } as any;
      mockChatbotService.listSessions.mockResolvedValue({ data: [], total: 0 });

      await controller.listSessions(query, patientUser);

      expect(mockChatbotService.listSessions).toHaveBeenCalledWith({
        userId: 'patient-1',
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

      expect(await controller.getSession('sess-1', patientUser)).toEqual(session);
      expect(mockChatbotService.getSession).toHaveBeenCalledWith('sess-1', 'patient-1');
    });
  });

  describe('sendMessage', () => {
    it('should delegate with session id, user id, and content', async () => {
      const dto = { content: 'ما هي مواعيد العمل؟' } as any;
      const result = { reply: 'من 8 صباحا...' };
      mockChatbotService.handleMessage.mockResolvedValue(result);

      expect(await controller.sendMessage('sess-1', dto, patientUser)).toEqual(result);
      expect(mockChatbotService.handleMessage).toHaveBeenCalledWith(
        'sess-1', 'patient-1', 'ما هي مواعيد العمل؟',
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

      await controller.streamMessage('sess-1', dto, patientUser, mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockRes.flushHeaders).toHaveBeenCalled();

      subject.next({ data: 'Hello' });
      expect(mockRes.write).toHaveBeenCalledWith('data: Hello\n\n');

      subject.next({ data: { event: 'tool', name: 'search' } });
      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ event: 'tool', name: 'search' })}\n\n`,
      );

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

      await controller.streamMessage('sess-1', dto, patientUser, mockRes as any);

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

      expect(await controller.endSession('sess-1', patientUser)).toEqual(result);
      expect(mockChatbotService.endSession).toHaveBeenCalledWith('sess-1', 'patient-1');
    });
  });
});
