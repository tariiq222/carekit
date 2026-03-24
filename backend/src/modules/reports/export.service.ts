import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

interface RevenueExportRow {
  month: Date;
  bookings: number;
  revenue: bigint;
  practitioner_name: string;
  service_name: string;
}

interface BookingExportRow {
  id: string;
  date: Date;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  patient_name: string;
  practitioner_name: string;
  service_name: string;
  total_amount: number | null;
  payment_status: string | null;
}

interface PatientExportRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  created_at: Date;
  total_bookings: bigint;
  total_spent: bigint;
}

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  CSV HELPER
  // ═══════════════════════════════════════════════════════════════

  generateCsv(
    headers: string[],
    rows: Record<string, unknown>[],
  ): string {
    const escapeCsvValue = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [headers.map(escapeCsvValue).join(',')];

    for (const row of rows) {
      const values = headers.map((h) => escapeCsvValue(row[h]));
      lines.push(values.join(','));
    }

    // BOM for Excel Arabic support
    return '\uFEFF' + lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════
  //  REVENUE CSV
  // ═══════════════════════════════════════════════════════════════

  async exportRevenueCsv(dateFrom: string, dateTo: string): Promise<string> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const rows = await this.prisma.$queryRaw<RevenueExportRow[]>`
      SELECT DATE_TRUNC('month', b.date)        AS month,
             COUNT(*)::int                       AS bookings,
             COALESCE(SUM(p.total_amount), 0)::bigint AS revenue,
             CONCAT(u.first_name, ' ', u.last_name)   AS practitioner_name,
             COALESCE(s.name_ar, s.name_en)            AS service_name
      FROM bookings b
      JOIN payments p ON p.booking_id = b.id
                     AND p.status = 'paid'::"payment_status"
      JOIN practitioners pr ON pr.id = b.practitioner_id
      JOIN users u ON u.id = pr.user_id
      JOIN services s ON s.id = b.service_id
      WHERE b.date >= ${from}
        AND b.date <= ${to}
        AND b.deleted_at IS NULL
      GROUP BY DATE_TRUNC('month', b.date),
               u.first_name, u.last_name,
               s.name_ar, s.name_en
      ORDER BY month, practitioner_name`;

    const headers = [
      'month',
      'practitioner_name',
      'service_name',
      'bookings',
      'revenue',
    ];

    const mapped = rows.map((r) => ({
      month: this.formatMonth(r.month),
      practitioner_name: r.practitioner_name,
      service_name: r.service_name,
      bookings: r.bookings,
      revenue: Number(r.revenue),
    }));

    return this.generateCsv(headers, mapped);
  }

  // ═══════════════════════════════════════════════════════════════
  //  BOOKINGS CSV
  // ═══════════════════════════════════════════════════════════════

  async exportBookingsCsv(dateFrom: string, dateTo: string): Promise<string> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const rows = await this.prisma.$queryRaw<BookingExportRow[]>`
      SELECT b.id,
             b.date,
             b.start_time,
             b.end_time,
             b.status::text,
             b.type::text,
             CONCAT(pat.first_name, ' ', pat.last_name) AS patient_name,
             CONCAT(pru.first_name, ' ', pru.last_name) AS practitioner_name,
             COALESCE(s.name_ar, s.name_en)              AS service_name,
             p.total_amount,
             p.status::text                              AS payment_status
      FROM bookings b
      LEFT JOIN users pat ON pat.id = b.patient_id
      JOIN practitioners pr ON pr.id = b.practitioner_id
      JOIN users pru ON pru.id = pr.user_id
      JOIN services s ON s.id = b.service_id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.date >= ${from}
        AND b.date <= ${to}
        AND b.deleted_at IS NULL
      ORDER BY b.date, b.start_time`;

    const headers = [
      'id',
      'date',
      'start_time',
      'end_time',
      'status',
      'type',
      'patient_name',
      'practitioner_name',
      'service_name',
      'total_amount',
      'payment_status',
    ];

    const mapped = rows.map((r) => ({
      id: r.id,
      date: new Date(r.date).toISOString().split('T')[0],
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status,
      type: r.type,
      patient_name: r.patient_name,
      practitioner_name: r.practitioner_name,
      service_name: r.service_name,
      total_amount: r.total_amount ?? '',
      payment_status: r.payment_status ?? '',
    }));

    return this.generateCsv(headers, mapped);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PATIENTS CSV
  // ═══════════════════════════════════════════════════════════════

  async exportPatientsCsv(): Promise<string> {
    const rows = await this.prisma.$queryRaw<PatientExportRow[]>`
      SELECT u.id,
             u.first_name,
             u.last_name,
             u.email,
             u.phone,
             u.gender::text,
             u.created_at,
             COUNT(b.id)::bigint                         AS total_bookings,
             COALESCE(SUM(
               CASE WHEN p.status = 'paid'::"payment_status"
                    THEN p.total_amount ELSE 0 END
             ), 0)::bigint                               AS total_spent
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id AND r.slug = 'patient'
      LEFT JOIN bookings b ON b.patient_id = u.id
                           AND b.deleted_at IS NULL
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE u.deleted_at IS NULL
      GROUP BY u.id, u.first_name, u.last_name,
               u.email, u.phone, u.gender, u.created_at
      ORDER BY u.created_at DESC`;

    const headers = [
      'id',
      'first_name',
      'last_name',
      'email',
      'phone',
      'gender',
      'created_at',
      'total_bookings',
      'total_spent',
    ];

    const mapped = rows.map((r) => ({
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      phone: r.phone ?? '',
      gender: r.gender ?? '',
      created_at: new Date(r.created_at).toISOString().split('T')[0],
      total_bookings: Number(r.total_bookings),
      total_spent: Number(r.total_spent),
    }));

    return this.generateCsv(headers, mapped);
  }

  private formatMonth(date: Date): string {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
