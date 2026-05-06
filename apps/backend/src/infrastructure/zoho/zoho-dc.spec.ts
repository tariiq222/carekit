import {
  ZOHO_DATA_CENTERS,
  isZohoDataCenter,
  normalizeDcFromOAuthResponse,
  zohoAccountsBaseUrl,
  zohoApiBaseUrl,
} from './zoho-dc';

describe('zoho-dc routing', () => {
  it('declares exactly the 7 supported regions', () => {
    expect([...ZOHO_DATA_CENTERS].sort()).toEqual(['au', 'ca', 'com', 'eu', 'in', 'jp', 'sa']);
  });

  it.each([
    ['com', 'https://accounts.zoho.com', 'https://www.zohoapis.com'],
    ['sa', 'https://accounts.zoho.sa', 'https://www.zohoapis.sa'],
    ['eu', 'https://accounts.zoho.eu', 'https://www.zohoapis.eu'],
    ['in', 'https://accounts.zoho.in', 'https://www.zohoapis.in'],
    ['au', 'https://accounts.zoho.com.au', 'https://www.zohoapis.com.au'],
    ['jp', 'https://accounts.zoho.jp', 'https://www.zohoapis.jp'],
    ['ca', 'https://accounts.zohocloud.ca', 'https://www.zohoapis.ca'],
  ] as const)('routes %s to the correct accounts + api hosts', (dc, accounts, api) => {
    expect(zohoAccountsBaseUrl(dc)).toBe(accounts);
    expect(zohoApiBaseUrl(dc)).toBe(api);
  });

  it('isZohoDataCenter narrows correctly', () => {
    expect(isZohoDataCenter('sa')).toBe(true);
    expect(isZohoDataCenter('us')).toBe(false);
    expect(isZohoDataCenter('')).toBe(false);
    expect(isZohoDataCenter('SA')).toBe(false); // case-sensitive on purpose
  });

  describe('normalizeDcFromOAuthResponse', () => {
    it('falls back to the user-selected DC when Zoho omits location', () => {
      expect(normalizeDcFromOAuthResponse(undefined, 'sa')).toBe('sa');
      expect(normalizeDcFromOAuthResponse(null, 'eu')).toBe('eu');
      expect(normalizeDcFromOAuthResponse('', 'in')).toBe('in');
    });

    it('lowercases + accepts known DCs', () => {
      expect(normalizeDcFromOAuthResponse('SA', 'com')).toBe('sa');
      expect(normalizeDcFromOAuthResponse('  EU  ', 'com')).toBe('eu');
    });

    it('normalises com.au → au', () => {
      expect(normalizeDcFromOAuthResponse('com.au', 'com')).toBe('au');
    });

    it('falls back when Zoho returns a region we do not support', () => {
      expect(normalizeDcFromOAuthResponse('ru', 'sa')).toBe('sa');
    });
  });
});
