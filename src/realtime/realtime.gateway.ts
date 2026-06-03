import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocket, WebSocketServer as WsServer } from 'ws';

// ---------------------------------------------------------------------------
// Event payload types emitted by LiveScoreService
// ---------------------------------------------------------------------------

export interface MatchUpdatedEvent {
  matchId: string;
  data: {
    status: string;
    minute: number | null;
    homeScore: number | null;
    awayScore: number | null;
    homePens: number | null;
    awayPens: number | null;
  };
}

export interface MatchEventsUpdatedEvent {
  matchId: string;
  events: unknown[];
}

// ---------------------------------------------------------------------------
// Subscription payload from clients
// ---------------------------------------------------------------------------

interface SubscribePayload {
  topic?: 'live';
  matchId?: string;
}

/**
 * WebSocket gateway — single path /ws, same port as HTTP (3000).
 * Clients connect, send a subscribe message, and receive push updates.
 *
 * Protocol (JSON frames) — NestJS ws adapter uses "event"/"data" keys:
 *   Client → Server:  { "event": "subscribe", "data": { "topic": "live" } }
 *                     { "event": "subscribe", "data": { "matchId": "<uuid>" } }
 *   Server → Client:  { "type": "match.updated",        "matchId": "...", "data": {...} }
 *                     { "type": "match.events.updated",  "matchId": "...", "events": [...] }
 *                     { "type": "subscribed",            "topic": "live" | "match", "matchId"?: "..." }
 *                     { "type": "error",                 "message": "..." }
 */
@WebSocketGateway({ path: '/ws' })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: WsServer;

  private readonly logger = new Logger(RealtimeGateway.name);

  /** matchId → connected clients subscribed to that match */
  private readonly matchSubs = new Map<string, Set<WebSocket>>();
  /** clients subscribed to all live matches */
  private readonly liveSubs = new Set<WebSocket>();

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  handleConnection(client: WebSocket): void {
    this.logger.debug(
      `Client connected (total=${this.server?.clients?.size ?? '?'})`,
    );
    client.on('error', (err) => {
      this.logger.warn(`WS client error: ${err.message}`);
    });
  }

  handleDisconnect(client: WebSocket): void {
    this.liveSubs.delete(client);
    for (const [matchId, subs] of this.matchSubs) {
      subs.delete(client);
      if (subs.size === 0) this.matchSubs.delete(matchId);
    }
    this.logger.debug('Client disconnected — cleaned up subscriptions');
  }

  // -------------------------------------------------------------------------
  // Client messages
  // -------------------------------------------------------------------------

  @SubscribeMessage('subscribe')
  handleSubscribe(client: WebSocket, payload: SubscribePayload): void {
    if (payload.topic === 'live') {
      this.liveSubs.add(client);
      this.send(client, { type: 'subscribed', topic: 'live' });
      return;
    }
    if (payload.matchId) {
      if (!this.matchSubs.has(payload.matchId)) {
        this.matchSubs.set(payload.matchId, new Set());
      }
      this.matchSubs.get(payload.matchId)!.add(client);
      this.send(client, {
        type: 'subscribed',
        topic: 'match',
        matchId: payload.matchId,
      });
      return;
    }
    this.send(client, {
      type: 'error',
      message: 'subscribe requires topic="live" or matchId',
    });
  }

  // -------------------------------------------------------------------------
  // Internal event listeners (fired by LiveScoreService via EventEmitter2)
  // -------------------------------------------------------------------------

  @OnEvent('match.updated')
  onMatchUpdated(event: MatchUpdatedEvent): void {
    const frame = {
      type: 'match.updated',
      matchId: event.matchId,
      data: event.data,
    };
    this.broadcast(event.matchId, frame);
  }

  @OnEvent('match.events.updated')
  onMatchEventsUpdated(event: MatchEventsUpdatedEvent): void {
    const frame = {
      type: 'match.events.updated',
      matchId: event.matchId,
      events: event.events,
    };
    this.broadcast(event.matchId, frame);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private broadcast(matchId: string, frame: Record<string, unknown>): void {
    const json = JSON.stringify(frame);
    const matchClients = this.matchSubs.get(matchId);
    if (matchClients) {
      for (const c of matchClients) this.sendRaw(c, json);
    }
    for (const c of this.liveSubs) this.sendRaw(c, json);
  }

  private send(client: WebSocket, data: Record<string, unknown>): void {
    this.sendRaw(client, JSON.stringify(data));
  }

  private sendRaw(client: WebSocket, json: string): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}
