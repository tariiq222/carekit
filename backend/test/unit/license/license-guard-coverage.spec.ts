/**
 * License Guard Coverage Audit Tests
 *
 * These tests verify that ALL controllers behind a licensable feature
 * are protected by FeatureFlagGuard + @RequireFeature decorator.
 *
 * PURPOSE: Catch missing guard protection — if a controller for a licensed
 * feature lacks the guard, disabling the license won't block API access.
 *
 * CURRENT STATUS: These tests document KNOWN GAPS. Each test is marked
 * with the expected fix (adding FeatureFlagGuard + @RequireFeature).
 * Failing tests here = unprotected endpoints = security risk.
 */
import * as fs from 'fs';
import * as path from 'path';

const MODULES_DIR = path.resolve(__dirname, '../../../src/modules');

/**
 * Maps license keys to the controllers that MUST be guarded.
 * Format: { licenseKey: [{ module, controllerFile, featureKey }] }
 */
const LICENSED_CONTROLLERS = [
  { licenseKey: 'hasCoupons', module: 'coupons', file: 'coupons.controller.ts', featureKey: 'coupons' },
  { licenseKey: 'hasGiftCards', module: 'gift-cards', file: 'gift-cards.controller.ts', featureKey: 'gift_cards' },
  { licenseKey: 'hasIntakeForms', module: 'intake-forms', file: 'intake-forms.controller.ts', featureKey: 'intake_forms' },
  { licenseKey: 'hasChatbot', module: 'chatbot', file: 'chatbot.controller.ts', featureKey: 'chatbot' },
  { licenseKey: 'hasChatbot', module: 'chatbot', file: 'chatbot-kb.controller.ts', featureKey: 'chatbot' },
  { licenseKey: 'hasChatbot', module: 'chatbot', file: 'chatbot-admin.controller.ts', featureKey: 'chatbot' },
  { licenseKey: 'hasRatings', module: 'ratings', file: 'ratings.controller.ts', featureKey: 'ratings' },
  { licenseKey: 'hasReports', module: 'reports', file: 'reports.controller.ts', featureKey: 'reports' },
  { licenseKey: 'hasMultiBranch', module: 'branches', file: 'branches.controller.ts', featureKey: 'multi_branch' },
  { licenseKey: 'hasDepartments', module: 'departments', file: 'departments.controller.ts', featureKey: 'departments' },
];

function readControllerSource(moduleName: string, fileName: string): string {
  const filePath = path.join(MODULES_DIR, moduleName, fileName);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

describe('License Guard Coverage Audit', () => {
  describe.each(LICENSED_CONTROLLERS)(
    '$module/$file (license: $licenseKey)',
    ({ module: moduleName, file, featureKey }) => {
      let source: string;

      beforeAll(() => {
        source = readControllerSource(moduleName, file);
      });

      it(`should exist at modules/${moduleName}/${file}`, () => {
        expect(source.length).toBeGreaterThan(0);
      });

      it('should import FeatureFlagGuard', () => {
        expect(source).toContain('FeatureFlagGuard');
      });

      it('should include FeatureFlagGuard in @UseGuards()', () => {
        // Match @UseGuards(..., FeatureFlagGuard, ...) or @UseGuards(FeatureFlagGuard)
        const guardsRegex = /@UseGuards\([^)]*FeatureFlagGuard[^)]*\)/;
        expect(source).toMatch(guardsRegex);
      });

      it(`should have @RequireFeature('${featureKey}')`, () => {
        expect(source).toContain(`@RequireFeature('${featureKey}')`);
      });
    },
  );
});
