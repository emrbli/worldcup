import { Module } from '@nestjs/common';
import { EspnSummaryClient } from '../../adapters/espn/espn.summary-client.js';
import { LineupsSyncService } from './lineups.service.js';
import { LineupsSyncScheduler } from './lineups.scheduler.js';

@Module({
  providers: [EspnSummaryClient, LineupsSyncService, LineupsSyncScheduler],
  exports: [LineupsSyncService],
})
export class LineupsModule {}
