import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service.js';
import {
  FanZoneQueryDto,
  NewsQueryDto,
  VisaQueryDto,
} from './dto/content-query.dto.js';

@ApiTags('Content')
@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('teams/:id/profile')
  @ApiOperation({
    summary: 'Team profile: coach, style, key players, WC history',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getTeamProfile(@Param('id', ParseUUIDPipe) id: string) {
    const profile = await this.contentService.getTeamProfile(id);
    if (!profile) throw new NotFoundException(`Team profile ${id} not found`);
    return profile;
  }

  @Get('cities')
  @ApiOperation({ summary: 'List cities (with guide availability flag)' })
  getCities() {
    return this.contentService.getCities();
  }

  @Get('cities/:id/guide')
  @ApiOperation({
    summary: 'City guide: highlights, transit, food, tips + fan zones',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getCityGuide(@Param('id', ParseUUIDPipe) id: string) {
    const guide = await this.contentService.getCityGuide(id);
    if (!guide) throw new NotFoundException(`City guide ${id} not found`);
    return guide;
  }

  @Get('h2h/:teamAId/:teamBId')
  @ApiOperation({ summary: 'Head-to-head history (order-independent)' })
  @ApiParam({ name: 'teamAId', format: 'uuid' })
  @ApiParam({ name: 'teamBId', format: 'uuid' })
  async getH2H(
    @Param('teamAId', ParseUUIDPipe) teamAId: string,
    @Param('teamBId', ParseUUIDPipe) teamBId: string,
  ) {
    const h2h = await this.contentService.getH2H(teamAId, teamBId);
    if (!h2h) throw new NotFoundException(`H2H not found for given team pair`);
    return h2h;
  }

  @Get('fan-zones')
  @ApiOperation({ summary: 'Fan zones (filter by city)' })
  getFanZones(@Query() query: FanZoneQueryDto) {
    return this.contentService.getFanZones(query.city);
  }

  @Get('visa')
  @ApiOperation({ summary: 'Visa requirements (filter by nationality/host)' })
  getVisaInfo(@Query() query: VisaQueryDto) {
    return this.contentService.getVisaInfo(query.nationality, query.host);
  }

  @Get('news')
  @ApiOperation({ summary: 'Latest news (limit 1-100)' })
  getNews(@Query() query: NewsQueryDto) {
    return this.contentService.getNews(query.limit);
  }

  @Get('odds')
  @ApiOperation({ summary: 'Tournament odds' })
  getTournamentOdds() {
    return this.contentService.getTournamentOdds();
  }
}
