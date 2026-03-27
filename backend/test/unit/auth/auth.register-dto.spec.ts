/**
 * RegisterDto — Password Policy Unit Tests
 * Covers: AU-R2 (weak password), AU-R3 (short password)
 *
 * Uses class-validator directly to test DTO validation rules in isolation.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from '../../../src/modules/auth/dto/register.dto.js';

const validBase = {
  email: 'test@example.com',
  firstName: 'أحمد',
  lastName: 'الراشد',
};

async function getPasswordErrors(password: string): Promise<string[]> {
  const dto = plainToInstance(RegisterDto, { ...validBase, password });
  const errors = await validate(dto);
  return errors
    .filter((e) => e.property === 'password')
    .flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('RegisterDto — password policy (AU-R2, AU-R3)', () => {
  it('AU-R2: should reject password with no uppercase letter', async () => {
    const errors = await getPasswordErrors('nouppercase1');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((m) => m.toLowerCase().includes('uppercase'))).toBe(true);
  });

  it('AU-R2: should reject password with no digit', async () => {
    const errors = await getPasswordErrors('NoDigitPass!');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((m) => m.toLowerCase().includes('digit'))).toBe(true);
  });

  it('AU-R2: should reject password with no lowercase letter', async () => {
    const errors = await getPasswordErrors('NOLOWER1234');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('AU-R3: should reject password shorter than 8 characters', async () => {
    const errors = await getPasswordErrors('Ab1!');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept a password meeting all requirements', async () => {
    const errors = await getPasswordErrors('Str0ngP@ss!');
    expect(errors.length).toBe(0);
  });

  it('should accept minimum valid password (exactly 8 chars with all requirements)', async () => {
    const errors = await getPasswordErrors('Abcde1!x');
    expect(errors.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Boundary & optional field tests
// ---------------------------------------------------------------------------

describe('RegisterDto — boundary & optional fields', () => {
  it('password exactly 7 chars should fail (below MinLength(8))', async () => {
    const errors = await getPasswordErrors('Abc1!xy');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('password exactly 8 chars with all requirements should pass', async () => {
    const errors = await getPasswordErrors('Abc1!xyz');
    expect(errors.length).toBe(0);
  });

  it('email with leading/trailing spaces should be trimmed by @Transform and pass validation', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validBase,
      email: '  boundary@example.com  ',
      password: 'Str0ngP@ss!',
    });
    const errors = await validate(dto);
    const emailErrors = errors.filter((e) => e.property === 'email');
    expect(emailErrors.length).toBe(0);
    // @Transform fires during plainToInstance — value is already trimmed
    expect(dto.email).toBe('boundary@example.com');
  });

  it('phone = undefined should pass (@IsOptional skips all validators)', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validBase,
      password: 'Str0ngP@ss!',
      // phone omitted
    });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'phone').length).toBe(0);
  });

  it('phone = null should pass (@IsOptional treats null as absent)', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validBase,
      password: 'Str0ngP@ss!',
      phone: null,
    });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'phone').length).toBe(0);
  });

  it('gender = undefined should pass (@IsOptional skips all validators)', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validBase,
      password: 'Str0ngP@ss!',
      // gender omitted
    });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'gender').length).toBe(0);
  });

  it('gender = null should pass (@IsOptional treats null as absent)', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validBase,
      password: 'Str0ngP@ss!',
      gender: null,
    });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'gender').length).toBe(0);
  });
});
