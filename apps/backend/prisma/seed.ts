/**
 * Dev seed — creates an ADMIN user for local development.
 *
 * Run:  npx tsx prisma/seed.ts
 *
 * On success it prints the tenantId and patches dashboard/.env automatically.
 * Safe to re-run: skips creation if user already exists for that tenant.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const TENANT_ID      = process.env.SEED_TENANT_ID ?? crypto.randomUUID();
const ADMIN_EMAIL    = process.env.SEED_EMAIL      ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env.SEED_PASSWORD   ?? 'Admin@1234';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  await prisma.$connect();

  // ── Admin user ─────────────────────────────────────────────────────────────
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: TENANT_ID, email: ADMIN_EMAIL } },
  });

  if (!existing) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.user.create({
      data: {
        tenantId:     TENANT_ID,
        email:        ADMIN_EMAIL,
        passwordHash,
        name:         'Admin',
        role:         'ADMIN',
        isActive:     true,
      },
    });
    console.log(`✔  Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(`–  Admin user already exists: ${ADMIN_EMAIL}`);
  }

  await prisma.$disconnect();

  // ── Patch dashboard .env ───────────────────────────────────────────────────
  const envPath = path.resolve(__dirname, '../../dashboard/.env');
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    if (/^NEXT_PUBLIC_TENANT_ID=/m.test(content)) {
      content = content.replace(
        /^NEXT_PUBLIC_TENANT_ID=.*/m,
        `NEXT_PUBLIC_TENANT_ID=${TENANT_ID}`,
      );
    } else {
      content += `\nNEXT_PUBLIC_TENANT_ID=${TENANT_ID}\n`;
    }
    fs.writeFileSync(envPath, content);
    console.log(`✔  Patched dashboard .env → NEXT_PUBLIC_TENANT_ID=${TENANT_ID}`);
  }

  console.log('\n─────────────────────────────────────────────');
  console.log(`Tenant ID : ${TENANT_ID}`);
  console.log(`Email     : ${ADMIN_EMAIL}`);
  console.log(`Password  : ${ADMIN_PASSWORD}`);
  console.log('─────────────────────────────────────────────');
  console.log('\nRestart the dashboard (Next.js) after patching .env.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
