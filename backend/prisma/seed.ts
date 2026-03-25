import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {
  MODULES,
  ACTIONS,
  ROLES,
  WHITE_LABEL_DEFAULTS,
  EMAIL_TEMPLATES,
} from './seed.data';
import { seedDemoData } from './seed.demo';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log('Seeding database...');

  // 1. Create all permissions (13 modules x 4 actions = 52)
  console.log('Creating permissions...');
  const permissionMap = new Map<string, string>();

  for (const module of MODULES) {
    for (const action of ACTIONS) {
      const permission = await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: { module, action, description: `${action} ${module}` },
      });
      permissionMap.set(`${module}:${action}`, permission.id);
    }
  }
  console.log(`  Created ${permissionMap.size} permissions`);

  // 2. Create roles and assign permissions
  console.log('Creating roles...');
  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { slug: roleDef.slug },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        isDefault: roleDef.isDefault,
        isSystem: roleDef.isSystem,
      },
      create: {
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description,
        isDefault: roleDef.isDefault,
        isSystem: roleDef.isSystem,
      },
    });

    for (const [module, actions] of Object.entries(roleDef.permissions)) {
      for (const action of actions) {
        const permissionId = permissionMap.get(`${module}:${action}`);
        if (permissionId) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId } },
            update: {},
            create: { roleId: role.id, permissionId },
          });
        }
      }
    }
    const permCount = Object.values(roleDef.permissions).flat().length;
    console.log(`  Role "${roleDef.name}" created with ${permCount} permissions`);
  }

  // 3. Create WhiteLabel config defaults (includes ZATCA keys)
  console.log('Creating WhiteLabel config...');
  for (const config of WHITE_LABEL_DEFAULTS) {
    await prisma.whiteLabelConfig.upsert({
      where: { key: config.key },
      update: {},
      create: {
        key: config.key,
        value: config.value,
        type: config.type,
        description: config.description,
      },
    });
  }
  console.log(`  Created ${WHITE_LABEL_DEFAULTS.length} config entries`);

  // 5. Create email templates
  console.log('Creating email templates...');
  for (const tpl of EMAIL_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { slug: tpl.slug },
      update: {},
      create: {
        slug: tpl.slug,
        nameAr: tpl.nameAr,
        nameEn: tpl.nameEn,
        subjectAr: tpl.subjectAr,
        subjectEn: tpl.subjectEn,
        bodyAr: tpl.bodyAr,
        bodyEn: tpl.bodyEn,
        variables: tpl.variables,
      },
    });
  }
  console.log(`  Created ${EMAIL_TEMPLATES.length} email templates`);

  // 6. Create super_admin user
  console.log('Creating super_admin user...');
  const adminEmail = 'admin@carekit-test.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Adm!nP@ss123', 10);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'عبدالله',
        lastName: 'الغامدي',
        phone: '+966501000001',
        gender: 'male',
        isActive: true,
        emailVerified: true,
      },
    });

    const superAdminRole = await prisma.role.findUnique({ where: { slug: 'super_admin' } });
    if (superAdminRole) {
      await prisma.userRole.create({
        data: { userId: adminUser.id, roleId: superAdminRole.id },
      });
    }

    console.log(`  Created super_admin user: ${adminEmail}`);
  } else {
    console.log(`  super_admin user already exists: ${adminEmail}`);
  }

  console.log('Base seeding complete!');

  // 7. Seed demo/fake data for all models
  await seedDemoData(prisma);

  console.log('All seeding complete!');
}

main()
  .catch((e: unknown) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
