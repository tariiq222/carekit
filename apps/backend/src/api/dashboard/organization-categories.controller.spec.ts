import { DashboardOrganizationCategoriesController } from './organization-categories.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createCategory = fn({ id: 'cat-1' });
  const updateCategory = fn({ id: 'cat-1' });
  const listCategories = fn({ data: [] });
  const controller = new DashboardOrganizationCategoriesController(
    createCategory as never, updateCategory as never, listCategories as never,
  );
  return { controller, createCategory, updateCategory, listCategories };
}

describe('DashboardOrganizationCategoriesController', () => {
  it('createCategoryEndpoint — passes tenantId', async () => {
    const { controller, createCategory } = buildController();
    await controller.createCategoryEndpoint(TENANT, { nameAr: 'فئة' } as never);
    expect(createCategory.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listCategoriesEndpoint — passes tenantId', async () => {
    const { controller, listCategories } = buildController();
    await controller.listCategoriesEndpoint(TENANT, {} as never);
    expect(listCategories.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('updateCategoryEndpoint — passes tenantId and categoryId', async () => {
    const { controller, updateCategory } = buildController();
    await controller.updateCategoryEndpoint(TENANT, 'cat-1', {} as never);
    expect(updateCategory.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, categoryId: 'cat-1' }),
    );
  });
});