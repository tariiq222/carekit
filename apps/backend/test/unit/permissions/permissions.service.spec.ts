/**
 * PermissionsService Unit Tests
 * Covers: findAll
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from '../../../src/modules/permissions/permissions.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

function createMockPrisma() {
  return {
    permission: {
      findMany: jest.fn(),
    },
  };
}

const mockPermissions = [
  { id: 'perm-1', module: 'bookings', action: 'create' },
  { id: 'perm-2', module: 'bookings', action: 'read' },
  { id: 'perm-3', module: 'patients', action: 'read' },
];

async function createModule(mockPrisma: ReturnType<typeof createMockPrisma>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PermissionsService,
      { provide: PrismaService, useValue: mockPrisma },
    ],
  }).compile();
  return module.get<PermissionsService>(PermissionsService);
}

describe('PermissionsService — findAll', () => {
  let service: PermissionsService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should return permissions ordered by module and action', async () => {
    mockPrisma.permission.findMany.mockResolvedValue(mockPermissions);

    const result = await service.findAll();

    expect(result).toEqual(mockPermissions);
    expect(mockPrisma.permission.findMany).toHaveBeenCalledWith({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  });

  it('should return empty array when no permissions exist', async () => {
    mockPrisma.permission.findMany.mockResolvedValue([]);

    const result = await service.findAll();

    expect(result).toEqual([]);
    expect(mockPrisma.permission.findMany).toHaveBeenCalledTimes(1);
  });
});
