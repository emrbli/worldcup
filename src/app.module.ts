import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppConfigModule } from './config/app-config.module.js';
import { DbModule } from './lib/db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { MatchesModule } from './matches/matches.module.js';
import { StandingsModule } from './standings/standings.module.js';
import { BracketModule } from './bracket/bracket.module.js';
import { LiveScoreModule } from './jobs/live-score/live-score.module.js';
import { OfficialsModule } from './jobs/pre-match-officials/officials.module.js';
import { LineupsModule } from './jobs/pre-match-lineups/lineups.module.js';
import { FifaSyncModule } from './jobs/fifa-sync/fifa-sync.module.js';
import { StandingsCalcModule } from './jobs/standings/standings.module.js';
import { ContentModule } from './content/content.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';

@Module({
  imports: [
    AppConfigModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DbModule,
    HealthModule,
    TeamsModule,
    GroupsModule,
    MatchesModule,
    StandingsModule,
    BracketModule,
    LiveScoreModule,
    OfficialsModule,
    LineupsModule,
    FifaSyncModule,
    StandingsCalcModule,
    ContentModule,
    DevicesModule,
    NotificationsModule,
    RealtimeModule,
  ],
  providers: [
    // Global Zod validation for all @Body/@Query/@Param createZodDto params
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
