import { Test } from '@nestjs/testing';
import { LogoutHandler } from './logout.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('LogoutHandler', () => {
  let handler: LogoutHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LogoutHandler,
        { provide: PrismaService, useValue: { refreshToken: { updateMany: jest.fn() } } },
      ],
    }).compile();
    handler = module.get(LogoutHandler);
    prisma = module.get(PrismaService);
  });

  it('revokes all refresh tokens for the user', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    await handler.execute({ userId: 'user-1' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
    );
  });
});
