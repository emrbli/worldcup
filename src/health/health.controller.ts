import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DrizzleHealthIndicator } from './indicators/drizzle.health.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly drizzle: DrizzleHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Database liveness check' })
  @HealthCheck()
  check() {
    return this.health.check([() => this.drizzle.isHealthy('database')]);
  }
}
