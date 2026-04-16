import { DashboardOrganizationCategoriesController } from './organization-categories.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createCategory = fn({ id: 'cat-1' });
  const updateCategory = fn({ id: 'cat-1' });
  const listCategories = fn({ data: [] });
  const deleteCategory = fn({ id: 'cat-1' });
  const controller = new DashboardOrganizationCategoriesController(
    createCategory as never,
    updateCategory as never,
    listCategories as never,
    deleteCategory as never,
  );
  return { controller, createCategory, updateCategory, listCategories, deleteCategory };
}

describe('DashboardOrganizationCategoriesController', () => {
  it('createCategoryEndpoint — passes body', async () => {
    const { controller, createCategory } = buildController();
    await controller.createCategoryEndpoint({ nameAr: 'فئة' } as never);
    expect(createCategory.execute).toHaveBeenCalled();
  });

  it('listCategoriesEndpoint — passes query', async () => {
    const { controller, listCategories } = buildController();
    await controller.listCategoriesEndpoint({} as never);
    expect(listCategories.execute).toHaveBeenCalled();
  });

  it('updateCategoryEndpoint — passes categoryId', async () => {
    const { controller, updateCategory } = buildController();
    await controller.updateCategoryEndpoint('cat-1', {} as never);
    expect(updateCategory.execute).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-1' }),
    );
  });

  it('deleteCategoryEndpoint — passes categoryId', async () => {
    const { controller, deleteCategory } = buildController();
    await controller.deleteCategoryEndpoint('cat-1');
    expect(deleteCategory.execute).toHaveBeenCalledWith({ categoryId: 'cat-1' });
  });
});
