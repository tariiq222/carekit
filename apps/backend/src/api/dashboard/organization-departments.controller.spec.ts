import { DashboardOrganizationDepartmentsController } from './organization-departments.controller';
import { REQUIRE_FEATURE_KEY } from '../../modules/platform/billing/feature.decorator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createDepartment = fn({ id: 'dept-1' });
  const updateDepartment = fn({ id: 'dept-1' });
  const listDepartments = fn({ data: [] });
  const deleteDepartment = fn({ deleted: true });
  const controller = new DashboardOrganizationDepartmentsController(
    createDepartment as never, updateDepartment as never, listDepartments as never,
    deleteDepartment as never,
  );
  return { controller, createDepartment, updateDepartment, listDepartments, deleteDepartment };
}

describe('DashboardOrganizationDepartmentsController', () => {
  it('createDepartmentEndpoint — passes body', async () => {
    const { controller, createDepartment } = buildController();
    await controller.createDepartmentEndpoint({ nameAr: 'قسم' } as never);
    expect(createDepartment.execute).toHaveBeenCalled();
  });

  it('listDepartmentsEndpoint — passes query', async () => {
    const { controller, listDepartments } = buildController();
    await controller.listDepartmentsEndpoint({} as never);
    expect(listDepartments.execute).toHaveBeenCalled();
  });

  it('updateDepartmentEndpoint — passes departmentId', async () => {
    const { controller, updateDepartment } = buildController();
    await controller.updateDepartmentEndpoint('dept-1', {} as never);
    expect(updateDepartment.execute).toHaveBeenCalledWith(
      expect.objectContaining({ departmentId: 'dept-1' }),
    );
  });

  it('deleteDepartmentEndpoint — passes departmentId', async () => {
    const { controller, deleteDepartment } = buildController();
    await controller.deleteDepartmentEndpoint('dept-1');
    expect(deleteDepartment.execute).toHaveBeenCalledWith({ departmentId: 'dept-1' });
  });
});

describe('@RequireFeature metadata — DEPARTMENTS', () => {
  it.each([
    'createDepartmentEndpoint',
    'updateDepartmentEndpoint',
    'deleteDepartmentEndpoint',
  ])('annotates %s with FeatureKey.DEPARTMENTS', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardOrganizationDepartmentsController.prototype as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.DEPARTMENTS);
  });
});
