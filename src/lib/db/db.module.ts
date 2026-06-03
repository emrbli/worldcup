import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { Env } from '../../config/env.validation.js';

export const DRIZZLE = Symbol('DRIZZLE');
export type DrizzleDb = NodePgDatabase<typeof schema>;

/**
 * Internal service that owns the pg Pool and Drizzle instance.
 * Implements OnModuleDestroy to cleanly end the pool on shutdown.
 */
@Injectable()
class DrizzleService implements OnModuleDestroy {
  readonly db: DrizzleDb;
  private readonly pool: Pool;

  constructor(config: ConfigService<Env, true>) {
    this.pool = new Pool({ connectionString: config.get('DATABASE_URL') });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Global DB module — provides `DRIZZLE` token everywhere without re-importing.
 *
 * Inject with:
 *   @Inject(DRIZZLE) private readonly db: DrizzleDb
 */
@Global()
@Module({
  providers: [
    DrizzleService,
    {
      provide: DRIZZLE,
      useFactory: (s: DrizzleService): DrizzleDb => s.db,
      inject: [DrizzleService],
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule {}
