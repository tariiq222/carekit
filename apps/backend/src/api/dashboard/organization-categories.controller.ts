import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { CreateCategoryHandler } from '../../modules/org-config/categories/create-category.handler';
import { CreateCategoryDto } from '../../modules/org-config/categories/create-category.dto';
import { UpdateCategoryHandler } from '../../modules/org-config/categories/update-category.handler';
import { UpdateCategoryDto } from '../../modules/org-config/categories/update-category.dto';
import { ListCategoriesHandler } from '../../modules/org-config/categories/list-categories.handler';
import { ListCategoriesDto } from '../../modules/org-config/categories/list-categories.dto';
import { DeleteCategoryHandler } from '../../modules/org-config/categories/delete-category.handler';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationCategoriesController {
  constructor(
    private readonly createCategory: CreateCategoryHandler,
    private readonly updateCategory: UpdateCategoryHandler,
    private readonly listCategories: ListCategoriesHandler,
    private readonly deleteCategory: DeleteCategoryHandler,
  ) {}

  @Post('categories')
  @CheckPermissions({ action: 'create', subject: 'Category' })
  createCategoryEndpoint(@Body() body: CreateCategoryDto) {
    return this.createCategory.execute(body);
  }

  @Get('categories')
  @CheckPermissions({ action: 'read', subject: 'Category' })
  listCategoriesEndpoint(@Query() query: ListCategoriesDto) {
    return this.listCategories.execute(query);
  }

  @Patch('categories/:categoryId')
  @CheckPermissions({ action: 'update', subject: 'Category' })
  updateCategoryEndpoint(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.updateCategory.execute({ categoryId, ...body });
  }

  @Delete('categories/:categoryId')
  @CheckPermissions({ action: 'delete', subject: 'Category' })
  deleteCategoryEndpoint(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.deleteCategory.execute({ categoryId });
  }
}
