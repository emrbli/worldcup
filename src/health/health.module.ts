import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { DrizzleHealthIndicator } from './indicators/drizzle.health.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DrizzleHealthIndicator],
})
export class HealthModule {}
