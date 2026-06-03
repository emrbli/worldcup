import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './env.validation.js';

/**
 * Global config module. Loads .env, validates with Zod, and makes
 * ConfigService available application-wide without re-importing.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
  ],
})
export class AppConfigModule {}
