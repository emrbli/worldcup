import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../lib/db/db.module.js';
import type { DrizzleDb } from '../lib/db/db.module.js';
import {
  teams,
  cities,
  teamProfiles,
  cityGuides,
  fanZones,
  visaInfo,
  historicalMatchups,
  news,
  odds,
} from '../lib/db/schema.js';

@Injectable()
export class ContentService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  // ---------------------------------------------------------------------------
  // Team profile
  // ---------------------------------------------------------------------------

  async getTeamProfile(teamId: string) {
    const [row] = await this.db
      .select({
        teamId: teamProfiles.teamId,
        coach: teamProfiles.coach,
        style: teamProfiles.style,
        keyPlayers: teamProfiles.keyPlayers,
        wcHistory: teamProfiles.wcHistory,
        qualifyingSummary: teamProfiles.qualifyingSummary,
        teamName: teams.name,
        teamFifa: teams.fifaCode,
        teamIso2: teams.iso2,
        nameI18n: teams.nameI18n,
      })
      .from(teamProfiles)
      .leftJoin(teams, eq(teamProfiles.teamId, teams.id))
      .where(eq(teamProfiles.teamId, teamId));
    return row ?? null;
  }

  // ---------------------------------------------------------------------------
  // Cities (with guide availability)
  // ---------------------------------------------------------------------------

  async getCities() {
    const rows = await this.db
      .select({
        id: cities.id,
        name: cities.name,
        country: cities.country,
        timezone: cities.timezone,
        hasGuide: sql<boolean>`${cityGuides.cityId} IS NOT NULL`,
      })
      .from(cities)
      .leftJoin(cityGuides, eq(cities.id, cityGuides.cityId))
      .orderBy(cities.country, cities.name);
    return rows;
  }

  // ---------------------------------------------------------------------------
  // City guide
  // ---------------------------------------------------------------------------

  async getCityGuide(cityId: string) {
    const [row] = await this.db
      .select()
      .from(cityGuides)
      .where(eq(cityGuides.cityId, cityId));
    if (!row) return null;

    const zones = await this.db
      .select({
        id: fanZones.id,
        name: fanZones.name,
        capacity: fanZones.capacity,
        hours: fanZones.hours,
      })
      .from(fanZones)
      .where(eq(fanZones.cityId, cityId));

    return { ...row, fanZones: zones };
  }

  // ---------------------------------------------------------------------------
  // H2H (order-independent pair)
  // ---------------------------------------------------------------------------

  async getH2H(teamAId: string, teamBId: string) {
    const [row] = await this.db
      .select()
      .from(historicalMatchups)
      .where(
        or(
          and(
            eq(historicalMatchups.teamAId, teamAId),
            eq(historicalMatchups.teamBId, teamBId),
          ),
          and(
            eq(historicalMatchups.teamAId, teamBId),
            eq(historicalMatchups.teamBId, teamAId),
          ),
        ),
      );
    return row ?? null;
  }

  // ---------------------------------------------------------------------------
  // Fan zones (optional city filter)
  // ---------------------------------------------------------------------------

  async getFanZones(cityId?: string) {
    const query = this.db
      .select({
        id: fanZones.id,
        name: fanZones.name,
        cityId: fanZones.cityId,
        address: fanZones.address,
        capacity: fanZones.capacity,
        hours: fanZones.hours,
        freeEntry: fanZones.freeEntry,
        activities: fanZones.activities,
        lat: fanZones.lat,
        lng: fanZones.lng,
        cityName: cities.name,
        country: cities.country,
      })
      .from(fanZones)
      .leftJoin(cities, eq(fanZones.cityId, cities.id));

    if (cityId) {
      return query.where(eq(fanZones.cityId, cityId));
    }
    return query.orderBy(cities.country, cities.name);
  }

  // ---------------------------------------------------------------------------
  // Visa info (optional filters)
  // ---------------------------------------------------------------------------

  async getVisaInfo(nationality?: string, host?: string) {
    const conditions = [];
    if (nationality) conditions.push(eq(visaInfo.nationality, nationality));
    if (host) conditions.push(eq(visaInfo.passportCountry, host));

    return this.db
      .select()
      .from(visaInfo)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(visaInfo.nationality);
  }

  // ---------------------------------------------------------------------------
  // News
  // ---------------------------------------------------------------------------

  async getNews(limit = 20) {
    return this.db
      .select({
        id: news.id,
        title: news.title,
        url: news.url,
        source: news.source,
        summary: news.summary,
        imageUrl: news.imageUrl,
        publishedAt: news.publishedAt,
        categories: news.categories,
        relatedTeams: news.relatedTeams,
      })
      .from(news)
      .where(isNotNull(news.title))
      .orderBy(desc(news.publishedAt))
      .limit(Math.min(limit, 100));
  }

  // ---------------------------------------------------------------------------
  // Tournament odds
  // ---------------------------------------------------------------------------

  async getTournamentOdds() {
    return this.db
      .select()
      .from(odds)
      .where(eq(odds.scope, 'tournament'))
      .orderBy(asc(odds.market));
  }
}
