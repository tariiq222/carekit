import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {
  MODULES,
  ACTIONS,
  EXTRA_PERMISSIONS,
  ROLES,
  WHITELABEL_DEFAULTS,
  LICENSE_DEFAULTS,
  CLINIC_SETTINGS_DEFAULTS,
  CLINIC_INTEGRATIONS_DEFAULTS,
  EMAIL_TEMPLATES,
  SPECIALTIES,
  FEATURE_FLAGS,
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

  // 1. Create all standard permissions (MODULES × ACTIONS matrix)
  console.log('Creating permissions...');
  const permissionMap = new Map<string, string>();

  for (const module of MODULES) {
    for (const action of ACTIONS) {
      const permission = await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: {
          module,
          action,
          description: `${action} ${module}`,
        },
      });
      permissionMap.set(`${module}:${action}`, permission.id);
    }
  }

  // 1b. Create extra/granular permissions
  for (const extra of EXTRA_PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { module_action: { module: extra.module, action: extra.action } },
      update: {
        description: extra.description,
        descriptionAr: extra.descriptionAr,
      },
      create: {
        module: extra.module,
        action: extra.action,
        description: extra.description,
        descriptionAr: extra.descriptionAr,
      },
    });
    permissionMap.set(`${extra.module}:${extra.action}`, permission.id);
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

    // Build the desired permission set for this role
    const desiredPermissionIds = new Set<string>();
    for (const [module, actions] of Object.entries(roleDef.permissions)) {
      for (const action of actions) {
        const permissionId = permissionMap.get(`${module}:${action}`);
        if (permissionId) desiredPermissionIds.add(permissionId);
      }
    }

    // Remove permissions no longer in the role definition (keeps DB in sync with seed)
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: [...desiredPermissionIds] } },
    });

    // Upsert the desired permissions
    for (const permissionId of desiredPermissionIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
    const permCount = Object.values(roleDef.permissions).flat().length;
    console.log(`  Role "${roleDef.name}" created with ${permCount} permissions`);
  }

  // 4. Seed WhiteLabelConfig (singleton)
  console.log('Seeding WhiteLabelConfig...');
  const existingWl = await prisma.whiteLabelConfig.findFirst();
  if (!existingWl) {
    await prisma.whiteLabelConfig.create({ data: WHITELABEL_DEFAULTS });
  }
  console.log('  WhiteLabelConfig seeded');

  // 5. Seed LicenseConfig (singleton)
  console.log('Seeding LicenseConfig...');
  const existingLicense = await prisma.licenseConfig.findFirst();
  if (!existingLicense) {
    await prisma.licenseConfig.create({ data: LICENSE_DEFAULTS });
  }
  console.log('  LicenseConfig seeded');

  // 6. Seed ClinicSettings (singleton)
  console.log('Seeding ClinicSettings...');
  const existingClinic = await prisma.clinicSettings.findFirst();
  if (!existingClinic) {
    await prisma.clinicSettings.create({ data: CLINIC_SETTINGS_DEFAULTS });
  }
  console.log('  ClinicSettings seeded');

  // 7. Seed ClinicIntegrations (singleton)
  console.log('Seeding ClinicIntegrations...');
  const existingIntegrations = await prisma.clinicIntegrations.findFirst();
  if (!existingIntegrations) {
    await prisma.clinicIntegrations.create({ data: CLINIC_INTEGRATIONS_DEFAULTS });
  }
  console.log('  ClinicIntegrations seeded');

  // 8. Create specialties
  console.log('Creating specialties...');
  for (const spec of SPECIALTIES) {
    await prisma.specialty.upsert({
      where: { nameEn: spec.nameEn },
      update: { nameAr: spec.nameAr, descriptionEn: spec.descriptionEn, descriptionAr: spec.descriptionAr, sortOrder: spec.sortOrder },
      create: { nameEn: spec.nameEn, nameAr: spec.nameAr, descriptionEn: spec.descriptionEn, descriptionAr: spec.descriptionAr, sortOrder: spec.sortOrder, isActive: true },
    });
  }
  console.log(`  Created ${SPECIALTIES.length} specialties`);

  // 9. Create email templates
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

  // 10. Create feature flags
  console.log('Creating feature flags...');
  for (const flag of FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {
        nameAr: flag.nameAr,
        nameEn: flag.nameEn,
        descriptionAr: flag.descriptionAr,
        descriptionEn: flag.descriptionEn,
      },
      create: {
        key: flag.key,
        nameAr: flag.nameAr,
        nameEn: flag.nameEn,
        descriptionAr: flag.descriptionAr,
        descriptionEn: flag.descriptionEn,
        enabled: flag.enabled,
      },
    });
  }
  console.log(`  Created ${FEATURE_FLAGS.length} feature flags`);

  // 11. Create super_admin user
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

  // 12. Seed demo/fake data for all models
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
