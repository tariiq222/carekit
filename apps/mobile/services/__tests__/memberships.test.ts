jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import api from '../api';
import {
  membershipsService,
  listMemberships,
  switchOrganization,
  type MembershipSummary,
} from '../memberships';

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

const sample: MembershipSummary = {
  id: 'm1',
  organizationId: 'org-1',
  role: 'OWNER',
  isActive: true,
  organization: {
    id: 'org-1',
    slug: 'acme',
    nameAr: 'أكمي',
    nameEn: 'Acme',
    status: 'ACTIVE',
  },
};

describe('membershipsService.list / listMemberships', () => {
  it('GETs /auth/memberships', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [sample] });
    const r = await membershipsService.list();
    expect(r).toEqual([sample]);
    expect(mockedApi.get).toHaveBeenCalledWith('/auth/memberships');
  });

  it('exposes a function-form alias', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await listMemberships();
    expect(mockedApi.get).toHaveBeenCalledWith('/auth/memberships');
  });
});

describe('membershipsService.switchOrganization', () => {
  it('POSTs to /auth/switch-org with { organizationId }', async () => {
    const tokens = {
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
    };
    mockedApi.post.mockResolvedValueOnce({ data: tokens });
    const r = await membershipsService.switchOrganization('org-2');
    expect(r).toEqual(tokens);
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/switch-org', {
      organizationId: 'org-2',
    });
  });

  it('exposes a function-form alias', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
    });
    await switchOrganization('org-3');
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/switch-org', {
      organizationId: 'org-3',
    });
  });
});
