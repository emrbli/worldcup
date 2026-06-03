import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../../lib/db/db.module.js';
import type { DrizzleDb } from '../../lib/db/db.module.js';

@Injectable()
export class DrizzleHealthIndicator extends HealthIndicator {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'Drizzle health check failed',
        this.getStatus(key, false, {
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
