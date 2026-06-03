import { Module } from '@nestjs/common';
import { StandingsController } from './standings.controller.js';
import { StandingsService } from './standings.service.js';

@Module({
  controllers: [StandingsController],
  providers: [StandingsService],
})
export class StandingsModule {}
