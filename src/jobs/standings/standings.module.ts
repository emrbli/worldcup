import { Module } from '@nestjs/common';
import { StandingsCalcService } from './standings-calc.service.js';

@Module({
  providers: [StandingsCalcService],
  exports: [StandingsCalcService],
})
export class StandingsCalcModule {}
