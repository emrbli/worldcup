import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../lib/db/db.module.js';
import type { DrizzleDb } from '../lib/db/db.module.js';
import type {
  RegisterDeviceDto,
  UpdateTokenDto,
} from './dto/register-device.dto.js';

@Injectable()
export class DevicesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * Register or update a device (idempotent upsert by device_id).
   * Returns the upserted device row.
   */
  async register(dto: RegisterDeviceDto): Promise<{ deviceId: string }> {
    await this.db.execute(sql`
      INSERT INTO devices (id, device_id, platform, push_token, locale, timezone, country, created_at, last_seen)
      VALUES (
        gen_random_uuid(),
        ${dto.deviceId},
        ${dto.platform},
        ${dto.pushToken ?? null},
        ${dto.locale ?? null},
        ${dto.timezone ?? null},
        ${dto.country ?? null},
        now(),
        now()
      )
      ON CONFLICT (device_id) DO UPDATE
        SET push_token = EXCLUDED.push_token,
            locale     = EXCLUDED.locale,
            timezone   = EXCLUDED.timezone,
            country    = EXCLUDED.country,
            last_seen  = now()
    `);
    return { deviceId: dto.deviceId };
  }

  /** Update only the push token for an existing device. */
  async updateToken(
    deviceId: string,
    dto: UpdateTokenDto,
  ): Promise<{ deviceId: string }> {
    await this.db.execute(sql`
      UPDATE devices
      SET push_token = ${dto.pushToken ?? null}, last_seen = now()
      WHERE device_id = ${deviceId}
    `);
    return { deviceId };
  }

  /** Fetch all valid push tokens (for notification broadcasts). */
  async getPushTokens(): Promise<string[]> {
    const rows = (await this.db.execute(sql`
      SELECT push_token FROM devices
      WHERE push_token IS NOT NULL
      LIMIT 1000
    `)) as { rows: { push_token: string }[] };
    return rows.rows.map((r) => r.push_token);
  }
}
