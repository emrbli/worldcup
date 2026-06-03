import { Module } from '@nestjs/common';
import { BracketController } from './bracket.controller.js';
import { BracketService } from './bracket.service.js';

@Module({
  controllers: [BracketController],
  providers: [BracketService],
})
export class BracketModule {}
