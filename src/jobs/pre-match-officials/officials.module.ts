import { Module } from '@nestjs/common';
import { FootballDataClient } from '../../adapters/football-data/football-data.client.js';
import { OfficialsSyncService } from './officials.service.js';
import { OfficialsSyncScheduler } from './officials.scheduler.js';

@Module({
  providers: [FootballDataClient, OfficialsSyncService, OfficialsSyncScheduler],
  exports: [OfficialsSyncService],
})
export class OfficialsModule {}
