import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const sql = [
  `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "isMain" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh'`,
];
for (const s of sql) { console.log('>', s); await prisma.$executeRawUnsafe(s); }
await prisma.$disconnect();
console.log('done');
