import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { FavoritePractitionersService } from './favorite-practitioners.service.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Favorite Practitioners')
@ApiBearerAuth()
@Controller('practitioners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FavoritePractitionersController {
  constructor(
    private readonly favoritesService: FavoritePractitionersService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET /practitioners/favorites — List patient's favorites
  //  (MUST be before :id to avoid route clash)
  // ═══════════════════════════════════════════════════════════════

  @Get('favorites')
  async getFavorites(@CurrentUser() user: { id: string }) {
    const data = await this.favoritesService.getFavorites(user.id);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /practitioners/:id/favorite — Add to favorites
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/favorite')
  async addFavorite(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.favoritesService.addFavorite(user.id, id);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  DELETE /practitioners/:id/favorite — Remove from favorites
  // ═══════════════════════════════════════════════════════════════

  @Delete(':id/favorite')
  async removeFavorite(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.favoritesService.removeFavorite(user.id, id);
    return { success: true, message: 'Removed from favorites' };
  }
}
