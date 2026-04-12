import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateCategoryHandler } from '../../modules/org-config/categories/create-category.handler';
import { CreateCategoryDto } from '../../modules/org-config/categories/create-category.dto';
import { UpdateCategoryHandler } from '../../modules/org-config/categories/update-category.handler';
import { UpdateCategoryDto } from '../../modules/org-config/categories/update-category.dto';
import { ListCategoriesHandler } from '../../modules/org-config/categories/list-categories.handler';
import { ListCategoriesDto } from '../../modules/org-config/categories/list-categories.dto';

@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationCategoriesController {
  constructor(
    private readonly createCategory: CreateCategoryHandler,
    private readonly updateCategory: UpdateCategoryHandler,
    private readonly listCategories: ListCategoriesHandler,
  ) {}

  @Post('categories')
  createCategoryEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateCategoryDto,
  ) {
    return this.createCategory.execute({ tenantId, ...body });
  }

  @Get('categories')
  listCategoriesEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListCategoriesDto,
  ) {
    return this.listCategories.execute({ tenantId, ...query });
  }

  @Patch('categories/:categoryId')
  updateCategoryEndpoint(
    @TenantId() tenantId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.updateCategory.execute({ tenantId, categoryId, ...body });
  }
}
