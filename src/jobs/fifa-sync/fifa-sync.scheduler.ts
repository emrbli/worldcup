import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { FifaSyncService } from './fifa-sync.service.js';
import type { Env } from '../../config/env.validation.js';

/**
 * FIFA enrichment scheduler (master plan §8 F). DEFAULT OFF
 * (FIFA_SYNC_ENABLED=false) — FIFA is secondary/enrichment, populated on demand
 * via `pnpm sync:fifa`. Enable only when you want periodic enrichment.
 */
@Injectable()
export class FifaSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(FifaSyncScheduler.name);
  private running = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly fifaSync: FifaSyncService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.config.get('FIFA_SYNC_ENABLED', { infer: true })) {
      this.logger.log('FIFA sync disabled (FIFA_SYNC_ENABLED=false).');
      return;
    }

    const expression = String(
      this.config.get('FIFA_SYNC_CRON', { infer: true }),
    );
    const job = CronJob.from({
      cronTime: expression,
      onTick: () => {
        void this.tick();
      },
    });
    this.registry.addCronJob('fifa-sync', job);
    job.start();
    this.logger.log(`FIFA sync enabled (cron: ${expression}).`);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous FIFA sync still running — skipping tick.');
      return;
    }
    this.running = true;
    try {
      await this.fifaSync.sync();
    } catch {
      // already logged in the service
    } finally {
      this.running = false;
    }
  }
}
