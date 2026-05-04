import { DashboardContentController } from './content.controller';
import { ListSiteSettingsHandler } from '../../modules/content/site-settings/list-site-settings.handler';
import { BulkUpsertSiteSettingsHandler } from '../../modules/content/site-settings/bulk-upsert-site-settings.handler';

describe('DashboardContentController', () => {
  let controller: DashboardContentController;
  let mockListSettings: Partial<ListSiteSettingsHandler>;
  let mockBulkUpsert: Partial<BulkUpsertSiteSettingsHandler>;

  beforeEach(() => {
    mockListSettings = { execute: jest.fn() };
    mockBulkUpsert = { execute: jest.fn() };
    controller = new DashboardContentController(
      mockListSettings as ListSiteSettingsHandler,
      mockBulkUpsert as BulkUpsertSiteSettingsHandler,
    );
  });

  describe('list', () => {
    it('calls listSettings.execute with empty options when no prefix', () => {
      (mockListSettings.execute as jest.Mock).mockResolvedValue([]);

      controller.list();

      expect(mockListSettings.execute).toHaveBeenCalledWith({});
    });

    it('calls listSettings.execute with prefix when provided', () => {
      (mockListSettings.execute as jest.Mock).mockResolvedValue([]);

      controller.list('home.hero.');

      expect(mockListSettings.execute).toHaveBeenCalledWith({ prefix: 'home.hero.' });
    });

    it('returns settings from handler', async () => {
      const settings = [{ key: 'site.title', value: 'My Site' }];
      (mockListSettings.execute as jest.Mock).mockResolvedValue(settings);

      const result = await controller.list();

      expect(result).toEqual(settings);
    });
  });

  describe('upsert', () => {
    it('calls bulkUpsert.execute with dto', () => {
      const dto = { settings: [{ key: 'site.title', valueAr: 'عنوان', valueEn: 'Title' }] };
      (mockBulkUpsert.execute as jest.Mock).mockResolvedValue({ count: 1 });

      controller.upsert(dto);

      expect(mockBulkUpsert.execute).toHaveBeenCalledWith(dto);
    });

    it('returns result from handler', async () => {
      const dto = { settings: [{ key: 'site.title', valueAr: 'عنوان' }] };
      const result = { count: 1 };
      (mockBulkUpsert.execute as jest.Mock).mockResolvedValue(result);

      const response = await controller.upsert(dto);

      expect(response).toEqual(result);
    });
  });
});
