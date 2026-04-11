// E2E tests for AI module — BullMQ queue-driven receipt verification

import * as crypto from 'crypto';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { createTestApp, closeTestApp, TestApp } from '../setup/setup';
import { ReceiptVerificationService } from '../../../src/modules/ai/receipt-verification.service';
import { ReceiptVerificationProcessor } from '../../../src/modules/ai/receipt-verification.processor';

const QUEUE_NAME = 'receipt-verification';

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

describe('AI Module (e2e)', () => {
  describe('ReceiptVerificationService — injectable', () => {
    it('should resolve the service from the module', () => {
      const service = testApp.module.get<ReceiptVerificationService>(
        ReceiptVerificationService,
      );
      expect(service).toBeDefined();
      expect(typeof service.verifyReceipt).toBe('function');
    });

    it('should throw NotFoundException for a non-existent receipt id', async () => {
      const service = testApp.module.get<ReceiptVerificationService>(
        ReceiptVerificationService,
      );
      const ghostId = crypto.randomUUID();

      await expect(service.verifyReceipt(ghostId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('NotFoundException payload should contain NOT_FOUND error code', async () => {
      const service = testApp.module.get<ReceiptVerificationService>(
        ReceiptVerificationService,
      );
      const ghostId = crypto.randomUUID();

      let caught: unknown;
      try {
        await service.verifyReceipt(ghostId);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(NotFoundException);
      const ex = caught as NotFoundException;
      const response = ex.getResponse() as Record<string, unknown>;
      expect(response.error).toBe('NOT_FOUND');
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Receipt verification queue integration', () => {
    it('should resolve the BullMQ queue from the module', () => {
      const queue = testApp.module.get<Queue>(getQueueToken(QUEUE_NAME));
      expect(queue).toBeDefined();
    });

    it('queue should have the correct name', () => {
      const queue = testApp.module.get<Queue>(getQueueToken(QUEUE_NAME));
      expect(queue.name).toBe(QUEUE_NAME);
    });

    it('should add a verify job to the queue without throwing', async () => {
      const queue = testApp.module.get<Queue>(getQueueToken(QUEUE_NAME));
      const ghostId = crypto.randomUUID();

      const job = await queue.add('verify', { receiptId: ghostId });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
    });

    it('queued job should have name "verify"', async () => {
      const queue = testApp.module.get<Queue>(getQueueToken(QUEUE_NAME));
      const ghostId = crypto.randomUUID();

      const job = await queue.add('verify', { receiptId: ghostId });

      expect(job.name).toBe('verify');
    });

    it('queued job data should contain the receiptId', async () => {
      const queue = testApp.module.get<Queue>(getQueueToken(QUEUE_NAME));
      const ghostId = crypto.randomUUID();

      const job = await queue.add('verify', { receiptId: ghostId });

      expect(job.data).toEqual({ receiptId: ghostId });
    });
  });

  describe('ReceiptVerificationProcessor — registered', () => {
    it('should resolve the processor from the module', () => {
      const processor = testApp.module.get<ReceiptVerificationProcessor>(
        ReceiptVerificationProcessor,
      );
      expect(processor).toBeDefined();
      expect(typeof processor.process).toBe('function');
    });
  });
});
