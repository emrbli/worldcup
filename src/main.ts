import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { WsAdapter } from '@nestjs/platform-ws';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.validation.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  // WebSocket adapter — attaches to the underlying Node HTTP server.
  // Works with Fastify because NestFastifyApplication.getHttpServer()
  // returns the raw http.Server that Fastify wraps.
  app.useWebSocketAdapter(new WsAdapter(app));

  // All REST routes are versioned under /v1; /health stays unprefixed.
  app.setGlobalPrefix('v1', { exclude: ['health'] });

  // ── OpenAPI / Swagger — Zod schemas → spec via nestjs-zod ──
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Worldcup Backend API')
    .setDescription('FIFA World Cup 2026 companion backend — REST v1')
    .setVersion('1.0')
    .build();
  const document = cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, swaggerConfig),
  );
  SwaggerModule.setup('docs', app, document); // UI: /docs · spec: /docs-json

  // Emit the spec to disk as a build artifact (non-fatal if fs is read-only).
  try {
    writeFileSync('docs/openapi.json', JSON.stringify(document, null, 2));
  } catch {
    // ignore — UI is still served from memory
  }

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
