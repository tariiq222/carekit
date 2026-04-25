import { ClientGender, ClientSource } from '@prisma/client';
import { MobileClientProfileController, MobileUpdateProfileBody } from './profile.controller';

const USER = { id: 'client-1', email: 'client@test.com', phone: null };

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const getClient = fn({ id: 'client-1', name: 'John Doe' });
  const updateClient = fn({ id: 'client-1', name: 'Jane Doe' });
  const controller = new MobileClientProfileController(getClient as never, updateClient as never);
  return { controller, getClient, updateClient };
}

describe('MobileClientProfileController', () => {
  describe('getProfile', () => {
    it('passes clientId to handler', async () => {
      const { controller, getClient } = buildController();
      await controller.getProfile(USER as never);
      expect(getClient.execute).toHaveBeenCalledWith({ clientId: USER.id });
    });

    it('returns handler result', async () => {
      const { controller } = buildController();
      const result = await controller.getProfile(USER as never);
      expect(result).toEqual({ id: 'client-1', name: 'John Doe' });
    });
  });

  describe('updateProfile', () => {
    it('passes clientId and body fields to handler', async () => {
      const { controller, updateClient } = buildController();
      const body: MobileUpdateProfileBody = { name: 'Jane Doe', phone: '+1234567890' };
      await controller.updateProfile(USER as never, body);
      expect(updateClient.execute).toHaveBeenCalledWith({
        clientId: USER.id,
        name: 'Jane Doe',
        phone: '+1234567890',
      });
    });

    it('handles optional fields like gender and dateOfBirth', async () => {
      const { controller, updateClient } = buildController();
      const body: MobileUpdateProfileBody = {
        name: 'Jane',
        gender: ClientGender.FEMALE,
        dateOfBirth: '1990-01-15',
      };
      await controller.updateProfile(USER as never, body);
      expect(updateClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({ gender: ClientGender.FEMALE, dateOfBirth: '1990-01-15' }),
      );
    });

    it('handles nullable fields like avatarUrl and notes', async () => {
      const { controller, updateClient } = buildController();
      const body: MobileUpdateProfileBody = { avatarUrl: null, notes: null };
      await controller.updateProfile(USER as never, body);
      expect(updateClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: null, notes: null }),
      );
    });

    it('handles source and isActive fields', async () => {
      const { controller, updateClient } = buildController();
      const body: MobileUpdateProfileBody = { source: ClientSource.WALK_IN, isActive: true };
      await controller.updateProfile(USER as never, body);
      expect(updateClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({ source: ClientSource.WALK_IN, isActive: true }),
      );
    });
  });
});
