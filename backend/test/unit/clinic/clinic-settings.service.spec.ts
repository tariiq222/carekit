import { Test } from '@nestjs/testing'
import { PrismaService } from '../../../src/database/prisma.service.js'
import { ClinicSettingsService } from '../../../src/modules/clinic/clinic-settings.service.js'

describe('ClinicSettingsService', () => {
  let service: ClinicSettingsService
  let prisma: { bookingSettings: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock } }

  beforeEach(async () => {
    prisma = {
      bookingSettings: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    }
    const module = await Test.createTestingModule({
      providers: [
        ClinicSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = module.get(ClinicSettingsService)
  })

  describe('getBookingFlowOrder', () => {
    it('returns service_first when no settings exist', async () => {
      prisma.bookingSettings.findFirst.mockResolvedValue(null)
      const result = await service.getBookingFlowOrder()
      expect(result).toBe('service_first')
    })

    it('returns stored value when settings exist', async () => {
      prisma.bookingSettings.findFirst.mockResolvedValue({
        bookingFlowOrder: 'practitioner_first',
      })
      const result = await service.getBookingFlowOrder()
      expect(result).toBe('practitioner_first')
    })
  })

  describe('updateBookingFlowOrder', () => {
    it('updates when a global settings row exists', async () => {
      const existingRow = { id: 'row-1', bookingFlowOrder: 'service_first' }
      prisma.bookingSettings.findFirst.mockResolvedValue(existingRow)
      prisma.bookingSettings.update.mockResolvedValue({
        bookingFlowOrder: 'practitioner_first',
      })

      const result = await service.updateBookingFlowOrder('practitioner_first')

      expect(prisma.bookingSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'row-1' },
          data: { bookingFlowOrder: 'practitioner_first' },
        }),
      )
      expect(result).toBe('practitioner_first')
    })

    it('creates when no global settings row exists', async () => {
      prisma.bookingSettings.findFirst.mockResolvedValue(null)
      prisma.bookingSettings.create.mockResolvedValue({
        bookingFlowOrder: 'practitioner_first',
      })

      const result = await service.updateBookingFlowOrder('practitioner_first')

      expect(prisma.bookingSettings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bookingFlowOrder: 'practitioner_first' }),
        }),
      )
      expect(result).toBe('practitioner_first')
    })
  })
})
