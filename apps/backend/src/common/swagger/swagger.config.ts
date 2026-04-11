import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('CareKit API')
    .setDescription('CareKit Clinic Management Platform — White-label API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication and session management')
    .addTag('Users', 'Staff user management')
    .addTag('Roles', 'Custom role definitions')
    .addTag('Permissions', 'Permission catalog (read-only)')
    .addTag('Patients', 'Patient profiles and walk-in registration')
    .addTag(
      'Practitioners',
      'Practitioner profiles, availability, and services',
    )
    .addTag('Favorite Practitioners', 'Patient favourite practitioners')
    .addTag('Services', 'Clinic service catalog')
    .addTag(
      'Branches',
      'Multi-branch management (requires multi_branch feature)',
    )
    .addTag(
      'Departments',
      'Department management (requires departments feature)',
    )
    .addTag('Bookings', 'Appointment booking lifecycle')
    .addTag('Booking Settings', 'Booking flow configuration')
    .addTag('Waitlist', 'Booking waitlist management')
    .addTag('Payments', 'Payment processing — Moyasar and bank transfer')
    .addTag('Invoices', 'Invoice generation and delivery')
    .addTag('Coupons', 'Discount coupons (requires coupons feature)')
    .addTag('Gift Cards', 'Gift card management (requires gift_cards feature)')
    .addTag('Groups', 'Group session management (requires groups feature)')
    .addTag(
      'Intake Forms',
      'Pre-appointment intake forms (requires intake_forms feature)',
    )
    .addTag('Ratings', 'Practitioner ratings (requires ratings feature)')
    .addTag('Notifications', 'In-app and push notifications')
    .addTag(
      'Chatbot',
      'AI chatbot sessions and knowledge base (requires chatbot feature)',
    )
    .addTag('Activity Log', 'Audit trail of system events')
    .addTag('Problem Reports', 'User-submitted booking issue reports')
    .addTag(
      'Reports',
      'Revenue and activity reports (requires reports feature)',
    )
    .addTag('Clinic', 'Working hours and holiday management')
    .addTag('Clinic Settings', 'Clinic identity and policy configuration')
    .addTag('Clinic Integrations', 'Third-party API credential management')
    .addTag('Whitelabel', 'Branding and white-label configuration')
    .addTag('Email Templates', 'Transactional email template management')
    .addTag('Feature Flags', 'Feature toggle management')
    .addTag('License', 'License and feature entitlement management')
    .addTag('ZATCA', 'Saudi e-invoicing compliance (Phase 2)')
    .addTag('Health', 'Service health check')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
