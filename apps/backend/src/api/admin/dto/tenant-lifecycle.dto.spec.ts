import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTenantDto } from './tenant-lifecycle.dto';

async function violations(input: Partial<CreateTenantDto>) {
  const errs = await validate(plainToInstance(CreateTenantDto, input as object));
  return errs.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CreateTenantDto.slug', () => {
  // All required fields except slug — use realistic test values so only
  // the slug field drives failures in these tests.
  const base: Partial<CreateTenantDto> = {
    nameAr: 'عيادة سواء',
  };

  it('rejects uppercase', async () => {
    const out = await violations({ ...base, slug: 'SAWA' });
    expect(out.join(' ')).toMatch(/slug/i);
  });

  it('rejects underscore', async () => {
    const out = await violations({ ...base, slug: 'sa_wa' });
    expect(out.join(' ')).toMatch(/slug/i);
  });

  it('rejects leading hyphen', async () => {
    const out = await violations({ ...base, slug: '-sawa' });
    expect(out.join(' ')).toMatch(/slug/i);
  });

  it('rejects trailing hyphen', async () => {
    const out = await violations({ ...base, slug: 'sawa-' });
    expect(out.join(' ')).toMatch(/slug/i);
  });

  it('rejects too short', async () => {
    const out = await violations({ ...base, slug: 'ab' });
    expect(out.join(' ')).toMatch(/slug/i);
  });

  it('rejects too long', async () => {
    const out = await violations({ ...base, slug: 'a'.repeat(31) });
    expect(out.join(' ')).toMatch(/slug/i);
  });

  it('rejects reserved word "admin"', async () => {
    const out = await violations({ ...base, slug: 'admin' });
    expect(out.join(' ').toLowerCase()).toMatch(/reserved|slug/);
  });

  it('accepts a valid slug', async () => {
    const out = await violations({ ...base, slug: 'sawa-clinic' });
    expect(out.find((m) => /slug/i.test(m))).toBeUndefined();
  });
});
