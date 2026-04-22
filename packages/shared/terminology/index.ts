// Terminology packs drive vertical-aware wording across dashboard and website.
// Each key has both Arabic and English values. The base pack is the template
// family's JSON; a Vertical may override individual keys via
// VerticalTerminologyOverride rows in the DB.

import medical from './medical.json' with { type: 'json' };
import consulting from './consulting.json' with { type: 'json' };
import salon from './salon.json' with { type: 'json' };
import fitness from './fitness.json' with { type: 'json' };

export const TEMPLATE_FAMILIES = ['MEDICAL', 'CONSULTING', 'SALON', 'FITNESS'] as const;
export type TemplateFamily = (typeof TEMPLATE_FAMILIES)[number];

export const TERMINOLOGY_KEYS = [
  'employee.singular',
  'employee.plural',
  'employee.possessive',
  'service.singular',
  'service.plural',
  'client.singular',
  'client.plural',
  'booking.singular',
  'booking.plural',
  'appointment.singular',
  'appointment.plural',
  'department.singular',
  'department.plural',
  'category.singular',
  'category.plural',
  'branch.singular',
  'branch.plural',
  'session.singular',
  'session.plural',
] as const;

export type TerminologyKey = (typeof TERMINOLOGY_KEYS)[number];

export interface TerminologyValue {
  ar: string;
  en: string;
}

export type TerminologyPack = Record<TerminologyKey, TerminologyValue>;

export const BASE_PACKS: Record<TemplateFamily, TerminologyPack> = {
  MEDICAL: medical as TerminologyPack,
  CONSULTING: consulting as TerminologyPack,
  SALON: salon as TerminologyPack,
  FITNESS: fitness as TerminologyPack,
};

export function mergeOverrides(
  base: TerminologyPack,
  overrides: Array<{ tokenKey: string; valueAr: string; valueEn: string }>,
): TerminologyPack {
  const out: TerminologyPack = { ...base };
  for (const o of overrides) {
    if ((TERMINOLOGY_KEYS as readonly string[]).includes(o.tokenKey)) {
      out[o.tokenKey as TerminologyKey] = { ar: o.valueAr, en: o.valueEn };
    }
  }
  return out;
}
