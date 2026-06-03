import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service.js';
import { TeamQueryDto } from './dto/team-query.dto.js';

@ApiTags('Teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'List teams (filter by group/confederation)' })
  findAll(@Query() query: TeamQueryDto) {
    return this.teamsService.findAll(query);
  }
}
