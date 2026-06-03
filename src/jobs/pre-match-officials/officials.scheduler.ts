import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { OfficialsSyncService } from './officials.service.js';
import type { Env } from '../../config/env.validation.js';

@Injectable()
export class OfficialsSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(OfficialsSyncScheduler.name);
  private running = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly officialsSync: OfficialsSyncService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.config.get('OFFICIALS_SYNC_ENABLED', { infer: true })) {
      this.logger.log(
        'Officials sync disabled (OFFICIALS_SYNC_ENABLED=false).',
      );
      return;
    }

    const expression = String(
      this.config.get('OFFICIALS_SYNC_CRON', { infer: true }),
    );
    const job = CronJob.from({
      cronTime: expression,
      onTick: () => {
        void this.tick();
      },
    });
    this.registry.addCronJob('officials-sync', job);
    job.start();
    this.logger.log(`Officials sync enabled (cron: ${expression}).`);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn(
        'Previous officials sync still running — skipping tick.',
      );
      return;
    }
    this.running = true;
    try {
      await this.officialsSync.sync();
    } catch {
      // already logged in the service
    } finally {
      this.running = false;
    }
  }
}
