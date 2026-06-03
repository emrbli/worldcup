import { Module } from '@nestjs/common';
import { EspnClient } from '../../adapters/espn/espn.client.js';
import { EspnSummaryClient } from '../../adapters/espn/espn.summary-client.js';
import { EspnScoreboardAdapter } from '../../adapters/espn/espn-scoreboard.adapter.js';
import { WorldcupJsonClient } from '../../adapters/worldcupjson/worldcupjson.client.js';
import { WorldcupJsonScoreboardAdapter } from '../../adapters/worldcupjson/worldcupjson-scoreboard.adapter.js';
import { FootballDataClient } from '../../adapters/football-data/football-data.client.js';
import { FootballDataScoreboardAdapter } from '../../adapters/football-data/football-data-scoreboard.adapter.js';
import { FifaClient } from '../../adapters/fifa/fifa.client.js';
import { FifaScoreboardAdapter } from '../../adapters/fifa/fifa-scoreboard.adapter.js';
import { LiveScoreService, LIVE_SCORE_ADAPTERS } from './live-score.service.js';
import { LiveScoreScheduler } from './live-score.scheduler.js';

@Module({
  providers: [
    // Individual adapter clients
    EspnClient,
    EspnSummaryClient,
    WorldcupJsonClient,
    FootballDataClient,
    FifaClient,

    // Adapter implementations (LiveScorePort)
    EspnScoreboardAdapter,
    WorldcupJsonScoreboardAdapter,
    FootballDataScoreboardAdapter,
    FifaScoreboardAdapter,

    // Priority-ordered adapter array injected into LiveScoreService
    // (sorted by .priority in the service: espn 1 → wcj 2 → fd 3 → fifa 4)
    {
      provide: LIVE_SCORE_ADAPTERS,
      useFactory: (
        espn: EspnScoreboardAdapter,
        wcj: WorldcupJsonScoreboardAdapter,
        fd: FootballDataScoreboardAdapter,
        fifa: FifaScoreboardAdapter,
      ) => [espn, wcj, fd, fifa],
      inject: [
        EspnScoreboardAdapter,
        WorldcupJsonScoreboardAdapter,
        FootballDataScoreboardAdapter,
        FifaScoreboardAdapter,
      ],
    },

    LiveScoreService,
    LiveScoreScheduler,
  ],
  exports: [LiveScoreService],
})
export class LiveScoreModule {}
