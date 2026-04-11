/**
 * ServiceListQueryDto — Validation Tests
 * Covers: perPage max value enforcement
 */
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ServiceListQueryDto } from '../../../src/modules/services/dto/service-list-query.dto.js';

describe('ServiceListQueryDto validation', () => {
  it('should reject perPage > 100', async () => {
    const dto = plainToInstance(ServiceListQueryDto, { perPage: 500 });
    const errors = await validate(dto);
    const perPageError = errors.find((e) => e.property === 'perPage');
    expect(perPageError).toBeDefined();
  });

  it('should accept perPage = 100', async () => {
    const dto = plainToInstance(ServiceListQueryDto, { perPage: 100 });
    const errors = await validate(dto);
    const perPageError = errors.find((e) => e.property === 'perPage');
    expect(perPageError).toBeUndefined();
  });

  it('should accept perPage < 100', async () => {
    const dto = plainToInstance(ServiceListQueryDto, { perPage: 20 });
    const errors = await validate(dto);
    const perPageError = errors.find((e) => e.property === 'perPage');
    expect(perPageError).toBeUndefined();
  });

  it('should reject perPage = 0', async () => {
    const dto = plainToInstance(ServiceListQueryDto, { perPage: 0 });
    const errors = await validate(dto);
    const perPageError = errors.find((e) => e.property === 'perPage');
    expect(perPageError).toBeDefined();
  });
});
