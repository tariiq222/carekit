/**
 * ExportService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from '../../../src/modules/reports/export.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  $queryRaw: jest.fn(),
};

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
    jest.clearAllMocks();
  });

  describe('generateCsv', () => {
    it('should produce header row + data rows', () => {
      const headers = ['name', 'age'];
      const rows = [
        { name: 'Ahmad', age: 30 },
        { name: 'Sara', age: 25 },
      ];

      const csv = service.generateCsv(headers, rows);

      expect(csv).toContain('name,age');
      expect(csv).toContain('Ahmad,30');
      expect(csv).toContain('Sara,25');
    });

    it('should start with BOM character for Excel Arabic support', () => {
      const csv = service.generateCsv(['col'], [{ col: 'value' }]);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });

    it('should escape values containing commas with quotes', () => {
      const csv = service.generateCsv(
        ['name'],
        [{ name: 'Ahmad, Jr.' }],
      );
      expect(csv).toContain('"Ahmad, Jr."');
    });

    it('should escape double quotes within values', () => {
      const csv = service.generateCsv(
        ['note'],
        [{ note: 'He said "hello"' }],
      );
      expect(csv).toContain('"He said ""hello"""');
    });

    it('should handle null and undefined as empty string', () => {
      const csv = service.generateCsv(
        ['a', 'b'],
        [{ a: null, b: undefined }],
      );
      // header,  blank row values
      expect(csv).toContain('a,b');
      const lines = csv.split('\n');
      expect(lines[1]).toBe(',');
    });

    it('should handle empty rows array (headers only)', () => {
      const csv = service.generateCsv(['id', 'name'], []);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(1); // only header
    });
  });

  describe('exportRevenueCsv', () => {
    it('should return CSV string with revenue columns', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          month: new Date('2026-01-01'),
          bookings: 10,
          revenue: BigInt(100000),
          practitioner_name: 'Dr. Ahmad',
          service_name: 'Consultation',
        },
      ]);

      const result = await service.exportRevenueCsv('2026-01-01', '2026-01-31');

      expect(result).toContain('month');
      expect(result).toContain('practitioner_name');
      expect(result).toContain('Dr. Ahmad');
    });
  });

  describe('exportBookingsCsv', () => {
    it('should return CSV string with booking columns', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'b-1',
          date: new Date('2026-03-01'),
          start_time: '10:00',
          end_time: '10:30',
          status: 'confirmed',
          type: 'in_person',
          patient_name: 'Sara Al-Ahmad',
          practitioner_name: 'Dr. Khalid',
          service_name: 'Checkup',
          total_amount: 15000,
          payment_status: 'paid',
        },
      ]);

      const result = await service.exportBookingsCsv('2026-03-01', '2026-03-31');

      expect(result).toContain('id');
      expect(result).toContain('Sara Al-Ahmad');
      expect(result).toContain('confirmed');
    });
  });

  describe('exportPatientsCsv', () => {
    it('should return CSV string with patient columns', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'p-1',
          first_name: 'Ahmad',
          last_name: 'Al-Rashid',
          email: 'ahmad@example.com',
          phone: '+966500000000',
          gender: 'male',
          created_at: new Date('2025-01-01'),
          total_bookings: BigInt(5),
          total_spent: BigInt(75000),
        },
      ]);

      const result = await service.exportPatientsCsv();

      expect(result).toContain('first_name');
      expect(result).toContain('Ahmad');
      expect(result).toContain('Al-Rashid');
    });
  });
});
