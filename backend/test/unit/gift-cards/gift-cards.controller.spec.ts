import { Test, TestingModule } from '@nestjs/testing';
import { GiftCardsController } from '../../../src/modules/gift-cards/gift-cards.controller.js';
import { GiftCardsService } from '../../../src/modules/gift-cards/gift-cards.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
  checkBalance: jest.fn(),
  addCredit: jest.fn(),
};

describe('GiftCardsController', () => {
  let controller: GiftCardsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GiftCardsController],
      providers: [{ provide: GiftCardsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GiftCardsController>(GiftCardsController);
  });

  describe('findAll', () => {
    it('should wrap result in success envelope', async () => {
      const cards = [{ id: 'gc1', code: 'GIFT-001' }];
      mockService.findAll.mockResolvedValue(cards);
      const query = {} as any;

      expect(await controller.findAll(query)).toEqual({ success: true, data: cards });
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findById', () => {
    it('should delegate with id', async () => {
      const card = { id: 'gc1', balance: 100 };
      mockService.findById.mockResolvedValue(card);

      expect(await controller.findById('gc1')).toEqual({ success: true, data: card });
    });
  });

  describe('create', () => {
    it('should delegate with dto', async () => {
      const dto = { initialBalance: 200 } as any;
      const created = { id: 'gc2', balance: 200 };
      mockService.create.mockResolvedValue(created);

      expect(await controller.create(dto)).toEqual({ success: true, data: created });
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should delegate with id and dto', async () => {
      const dto = { isActive: false } as any;
      const updated = { id: 'gc1', isActive: false };
      mockService.update.mockResolvedValue(updated);

      expect(await controller.update('gc1', dto)).toEqual({ success: true, data: updated });
      expect(mockService.update).toHaveBeenCalledWith('gc1', dto);
    });
  });

  describe('deactivate', () => {
    it('should delegate with id', async () => {
      const result = { id: 'gc1', isActive: false };
      mockService.deactivate.mockResolvedValue(result);

      expect(await controller.deactivate('gc1')).toEqual({ success: true, data: result });
      expect(mockService.deactivate).toHaveBeenCalledWith('gc1');
    });
  });

  describe('checkBalance', () => {
    it('should pass code from dto', async () => {
      const dto = { code: 'GIFT-001' } as any;
      const balance = { balance: 150, currency: 'SAR' };
      mockService.checkBalance.mockResolvedValue(balance);

      expect(await controller.checkBalance(dto)).toEqual({ success: true, data: balance });
      expect(mockService.checkBalance).toHaveBeenCalledWith('GIFT-001');
    });
  });

  describe('addCredit', () => {
    it('should delegate with id and dto', async () => {
      const dto = { amount: 50 } as any;
      const result = { id: 'gc1', balance: 250 };
      mockService.addCredit.mockResolvedValue(result);

      expect(await controller.addCredit('gc1', dto)).toEqual({ success: true, data: result });
      expect(mockService.addCredit).toHaveBeenCalledWith('gc1', dto);
    });
  });
});
