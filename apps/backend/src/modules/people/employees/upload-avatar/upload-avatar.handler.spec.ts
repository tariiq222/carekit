import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadAvatarHandler } from './upload-avatar.handler';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';
import { PrismaService } from '../../../../infrastructure/database';

const TENANT = '00000000-0000-0000-0000-000000000001';
const EMPLOYEE_ID = '00000000-0000-0000-0000-000000000002';
const MAX_AVATAR_BYTES = 1 * 1024 * 1024;

// Fake File row shape returned by UploadFileHandler.execute (Prisma File model).
// The real model has no `url` field — bucket + storageKey are used to compose it.
const MOCK_FILE_ROW = {
  id: 'file-9',
  bucket: 'carekit',
  storageKey: 'tenant/new.png',
  filename: 'a.png',
  mimetype: 'image/png',
  size: 1024,
  tenantId: TENANT,
} as const;

// Expected URL: ${MINIO_PUBLIC_URL}/${bucket}/${storageKey}
const EXPECTED_URL = `https://cdn/${MOCK_FILE_ROW.bucket}/${MOCK_FILE_ROW.storageKey}`;

function makeHandler(overrides: {
  employeeExists?: boolean;
  uploadResult?: typeof MOCK_FILE_ROW;
  throwOnUpload?: Error;
} = {}) {
  const employeeFindUnique = jest.fn().mockResolvedValue(
    overrides.employeeExists === false ? null : { id: EMPLOYEE_ID, tenantId: TENANT },
  );
  const employeeUpdate = jest.fn().mockResolvedValue({ id: EMPLOYEE_ID });
  const prisma = {
    employee: { findUnique: employeeFindUnique, update: employeeUpdate },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ employee: { update: employeeUpdate } }),
    ),
  } as unknown as PrismaService;

  const uploadFileExecute = overrides.throwOnUpload
    ? jest.fn().mockRejectedValue(overrides.throwOnUpload)
    : jest.fn().mockResolvedValue(overrides.uploadResult ?? MOCK_FILE_ROW);
  const uploadFile = { execute: uploadFileExecute } as unknown as UploadFileHandler;

  const config = {
    getOrThrow: (k: string) => {
      if (k === 'MINIO_PUBLIC_URL') return 'https://cdn';
      return 'carekit';
    },
  } as unknown as ConfigService;

  const handler = new UploadAvatarHandler(prisma, uploadFile, config);
  return { handler, employeeFindUnique, employeeUpdate, uploadFileExecute };
}

describe('UploadAvatarHandler', () => {
  const validCmd = {
    tenantId: TENANT,
    employeeId: EMPLOYEE_ID,
    filename: 'a.png',
    mimetype: 'image/png',
    size: 1024,
  };

  it('rejects non-image mimetype', async () => {
    const { handler } = makeHandler();
    await expect(
      handler.execute({ ...validCmd, mimetype: 'application/pdf' }, Buffer.alloc(1024)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized avatars', async () => {
    const { handler } = makeHandler();
    const size = MAX_AVATAR_BYTES + 1;
    await expect(
      handler.execute({ ...validCmd, size }, Buffer.alloc(size)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when employee does not exist under tenant', async () => {
    const { handler } = makeHandler({ employeeExists: false });
    await expect(
      handler.execute(validCmd, Buffer.alloc(1024)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('on happy path: calls uploadFile then updates employee.avatarUrl', async () => {
    const { handler, uploadFileExecute, employeeUpdate } = makeHandler();

    const res = await handler.execute(validCmd, Buffer.alloc(1024));

    expect(uploadFileExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        ownerType: 'employee',
        ownerId: EMPLOYEE_ID,
      }),
      expect.any(Buffer),
    );
    expect(employeeUpdate).toHaveBeenCalledWith({
      where: { id: EMPLOYEE_ID, tenantId: TENANT },
      data: { avatarUrl: EXPECTED_URL },
    });
    expect(res).toEqual({ fileId: MOCK_FILE_ROW.id, url: EXPECTED_URL });
  });
});
