import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { LineupsSyncService } from './lineups.service.js';
import type { Env } from '../../config/env.validation.js';

@Injectable()
export class LineupsSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(LineupsSyncScheduler.name);
  private running = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly lineupsSync: LineupsSyncService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.config.get('LINEUPS_SYNC_ENABLED', { infer: true })) {
      this.logger.log('Lineups sync disabled (LINEUPS_SYNC_ENABLED=false).');
      return;
    }

    const expression = String(
      this.config.get('LINEUPS_SYNC_CRON', { infer: true }),
    );
    const job = CronJob.from({
      cronTime: expression,
      onTick: () => {
        void this.tick();
      },
    });
    this.registry.addCronJob('lineups-sync', job);
    job.start();
    this.logger.log(`Lineups sync enabled (cron: ${expression}).`);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous lineups sync still running — skipping tick.');
      return;
    }
    this.running = true;
    try {
      await this.lineupsSync.sync();
    } catch {
      // already logged in the service
    } finally {
      this.running = false;
    }
  }
}
