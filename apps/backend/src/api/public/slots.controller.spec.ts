import { PublicSlotsController } from './slots.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

describe('PublicSlotsController', () => {
  it('getSlots — converts date string to Date and delegates to handler', async () => {
    const checkAvailability = fn({ slots: ['09:00', '10:00'] });
    const controller = new PublicSlotsController(checkAvailability as never);
    await controller.getSlots({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      branchId: 'branch-1',
      date: '2026-06-01',
    } as never);
    expect(checkAvailability.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: expect.any(Date),
      }),
    );
  });

  it('getSlots — passes optional durationMins and serviceId', async () => {
    const checkAvailability = fn({ slots: [] });
    const controller = new PublicSlotsController(checkAvailability as never);
    await controller.getSlots({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      branchId: 'branch-1',
      date: '2026-06-01',
      durationMins: 30,
      serviceId: 'svc-1',
    } as never);
    expect(checkAvailability.execute).toHaveBeenCalledWith(
      expect.objectContaining({ durationMins: 30, serviceId: 'svc-1' }),
    );
  });

  it('getSlots — bubbles error from handler', async () => {
    const checkAvailability = fn();
    checkAvailability.execute.mockRejectedValueOnce(new Error('employee not found'));
    const controller = new PublicSlotsController(checkAvailability as never);
    await expect(
      controller.getSlots({ tenantId: 't', employeeId: 'e', branchId: 'b', date: '2026-01-01' } as never),
    ).rejects.toThrow('employee not found');
  });
});
