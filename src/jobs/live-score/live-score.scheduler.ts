import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { LiveScoreService } from './live-score.service.js';
import type { Env } from '../../config/env.validation.js';

/**
 * Registers the live-score cron job at startup — only when LIVE_SYNC_ENABLED.
 * The cron expression is configurable via LIVE_SYNC_CRON.
 */
@Injectable()
export class LiveScoreScheduler implements OnModuleInit {
  private readonly logger = new Logger(LiveScoreScheduler.name);
  private running = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly liveScore: LiveScoreService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.config.get('LIVE_SYNC_ENABLED', { infer: true })) {
      this.logger.log('Live-score sync disabled (LIVE_SYNC_ENABLED=false).');
      return;
    }

    const expression = String(
      this.config.get('LIVE_SYNC_CRON', { infer: true }),
    );
    const job = CronJob.from({
      cronTime: expression,
      onTick: () => {
        void this.tick();
      },
    });
    this.registry.addCronJob('live-score', job);
    job.start();
    this.logger.log(`Live-score sync enabled (cron: ${expression}).`);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn(
        'Previous live-score sync still running — skipping tick.',
      );
      return;
    }
    this.running = true;
    try {
      await this.liveScore.syncDate();
    } catch {
      // already logged in the service; swallow so the cron keeps ticking
    } finally {
      this.running = false;
    }
  }
}
