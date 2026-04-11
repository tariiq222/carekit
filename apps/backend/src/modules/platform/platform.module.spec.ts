import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule } from './platform.module';
import { CheckFeatureHandler } from './license/check-feature.handler';
import { DatabaseModule } from '../../infrastructure/database';

describe('PlatformModule', () => {
  it('resolves CheckFeatureHandler', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        PlatformModule,
      ],
    }).compile();
    expect(module.get(CheckFeatureHandler)).toBeDefined();
  });
});
