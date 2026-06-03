import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { MatchesService } from './matches.service.js';
import { MatchQueryDto } from './dto/match-query.dto.js';

@ApiTags('Matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({
    summary: 'List matches (filter by stage/status/group/date/today)',
  })
  findAll(@Query() query: MatchQueryDto) {
    return this.matchesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Single match detail (incl. officials)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const match = await this.matchesService.findOne(id);
    if (!match) throw new NotFoundException(`Match ${id} not found`);
    return match;
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Match events (goals/cards ticker)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findEvents(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findEvents(id);
  }

  @Get(':id/lineups')
  @ApiOperation({ summary: 'Match lineups (starting XI per team)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findLineups(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findLineups(id);
  }
}
