import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StandingsService } from './standings.service.js';
import { StandingsQueryDto } from './dto/standings-query.dto.js';

@ApiTags('Standings')
@Controller('standings')
export class StandingsController {
  constructor(private readonly standingsService: StandingsService) {}

  @Get()
  @ApiOperation({ summary: 'Group standings (filter by group)' })
  findAll(@Query() query: StandingsQueryDto) {
    return this.standingsService.findAll(query);
  }
}
