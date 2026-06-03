import { Module } from '@nestjs/common';
import { FifaClient } from '../../adapters/fifa/fifa.client.js';
import { FifaSyncService } from './fifa-sync.service.js';
import { FifaSyncScheduler } from './fifa-sync.scheduler.js';

/**
 * FIFA enrichment module (master plan §8 F). Scheduler is default-OFF;
 * the service is also driven on demand by scripts/sync-fifa.ts.
 */
@Module({
  providers: [FifaClient, FifaSyncService, FifaSyncScheduler],
  exports: [FifaSyncService],
})
export class FifaSyncModule {}
