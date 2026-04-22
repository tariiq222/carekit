import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { PlatformModule } from './platform.module';
import { ListFeatureFlagsHandler } from './feature-flags/list-feature-flags.handler';
import { DatabaseModule } from '../../infrastructure/database';

describe('PlatformModule', () => {
  it('resolves ListFeatureFlagsHandler', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        DatabaseModule,
        PlatformModule,
      ],
    }).compile();
    expect(module.get(ListFeatureFlagsHandler)).toBeDefined();
  });
});
