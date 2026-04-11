/**
 * FavoritePractitionersController — Unit Tests (delegation)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { FavoritePractitionersController } from '../../../src/modules/practitioners/favorite-practitioners.controller.js';
import { FavoritePractitionersService } from '../../../src/modules/practitioners/favorite-practitioners.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockFavoritesService = {
  getFavorites: jest.fn(),
  addFavorite: jest.fn(),
  removeFavorite: jest.fn(),
};

const mockUser = { id: 'user-uuid-1' };
const mockPractitionerId = 'prac-uuid-1';

describe('FavoritePractitionersController', () => {
  let controller: FavoritePractitionersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritePractitionersController],
      providers: [
        {
          provide: FavoritePractitionersService,
          useValue: mockFavoritesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FavoritePractitionersController);
  });

  describe('getFavorites', () => {
    it('delegates to favoritesService.getFavorites(user.id) and returns { success, data }', async () => {
      const favorites = [{ id: mockPractitionerId }];
      mockFavoritesService.getFavorites.mockResolvedValue(favorites);

      const result = await controller.getFavorites(mockUser);

      expect(mockFavoritesService.getFavorites).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(result).toEqual({ success: true, data: favorites });
    });
  });

  describe('addFavorite', () => {
    it('delegates to favoritesService.addFavorite(user.id, id) and returns { success, data }', async () => {
      const added = { userId: mockUser.id, practitionerId: mockPractitionerId };
      mockFavoritesService.addFavorite.mockResolvedValue(added);

      const result = await controller.addFavorite(mockPractitionerId, mockUser);

      expect(mockFavoritesService.addFavorite).toHaveBeenCalledWith(
        mockUser.id,
        mockPractitionerId,
      );
      expect(result).toEqual({ success: true, data: added });
    });
  });

  describe('removeFavorite', () => {
    it('delegates to favoritesService.removeFavorite(user.id, id) and returns { success, message }', async () => {
      mockFavoritesService.removeFavorite.mockResolvedValue(undefined);

      const result = await controller.removeFavorite(
        mockPractitionerId,
        mockUser,
      );

      expect(mockFavoritesService.removeFavorite).toHaveBeenCalledWith(
        mockUser.id,
        mockPractitionerId,
      );
      expect(result).toEqual({
        success: true,
        message: 'Removed from favorites',
      });
    });
  });
});
