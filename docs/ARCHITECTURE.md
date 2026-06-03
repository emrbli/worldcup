# Architecture — worldcup-backend

This document illustrates the schema relationships, request lifecycle, and live
sync flow with diagrams. For a high-level overview see the [README](../README.md).

---

## 1. Data schema (ER)

```mermaid
erDiagram
  confederations ||--o{ teams : "code"
  groups ||--o{ teams : "group_id"
  groups ||--o{ matches : "group_id"
  groups ||--o{ standings : "group_id"
  teams ||--o{ standings : "team_id"
  teams ||--o{ matches : "home/away"
  cities ||--o{ venues : "city_id"
  venues ||--o{ matches : "venue_id"
  matches ||--o{ match_events : "match_id"
  matches ||--o{ match_lineups : "match_id"
  matches ||--o{ bracket_slots : "match_id"
  teams ||--o| team_profiles : "team_id"
  cities ||--o| city_guides : "city_id"
  cities ||--o{ fan_zones : "city_id"
  teams ||--o{ players : "team_id"
  teams ||--o{ historical_matchups : "team_a/b"

  teams {
    uuid id PK
    text fifa_code
    text iso2
    jsonb name_i18n "tr/en"
    uuid group_id FK
    jsonb source_ids
  }
  matches {
    uuid id PK
    int match_number
    text stage "group|r32|..|final"
    uuid home_team_id FK
    uuid away_team_id FK
    text home_placeholder "2A / W74"
    timestamptz kickoff_utc
    text status "scheduled|live|ht|ft|postponed"
    int home_score
    int away_score
    jsonb officials "referee/var/.."
    jsonb source_ids "espn/.."
  }
  standings {
    uuid group_id PK
    uuid team_id PK
    int points
    int gd
    int rank
  }
  bracket_slots {
    uuid id PK
    text round
    int position
    uuid match_id FK
    text home_source
    text away_source
  }
  match_events {
    uuid id PK
    uuid match_id FK
    text type "goal|yellow|red|.."
    int minute
    text player_name
  }
```

Full DDL and module list: `src/lib/db/schema/` (core · live · bracket · content · devices · ops).
Canonical ID = openfootball; other sources are mapped into `source_ids jsonb` (without schema changes).

---

## 2. Request lifecycle (REST)

```mermaid
sequenceDiagram
  participant C as Client
  participant F as Fastify (/v1)
  participant P as ZodValidationPipe
  participant Ctrl as Controller
  participant Svc as Service
  participant DB as Drizzle → Postgres

  C->>F: GET /v1/matches?stage=r32
  F->>P: validate query (Zod schema)
  alt invalid
    P-->>C: 400 Bad Request
  else valid
    P->>Ctrl: typed DTO
    Ctrl->>Svc: findAll(query)
    Svc->>DB: select + leftJoin
    DB-->>Svc: rows
    Svc-->>Ctrl: normalized JSON
    Ctrl-->>C: 200 + body
  end
```

UUID path params are validated with `ParseUUIDPipe` (invalid → 400, not found → 404).

---

## 3. Live sync loop

```mermaid
sequenceDiagram
  participant Cron as LiveScoreScheduler
  participant Svc as LiveScoreService
  participant ADP as Adapter chain
  participant DB as Postgres
  participant EV as EventEmitter2
  participant WS as RealtimeGateway
  participant Push as PushService

  Cron->>Svc: syncDate() (every min)
  Svc->>ADP: fetchWithFallback() ESPN→wcj→fd
  ADP-->>Svc: NormalizedMatchUpdate[]
  loop each match
    Svc->>Svc: resolveTarget() id→pair→kickoff
    Svc->>DB: UPDATE matches (score/status/+knockout team)
    Svc->>EV: emit match.updated
    alt live/ht
      Svc->>ADP: ESPN /summary → match_events
      Svc->>EV: emit match.events.updated
    end
    alt ft + group match
      Svc->>EV: emit standings.recalculate
    end
  end
  EV->>WS: push to subscribers
  EV->>Push: goal → Expo Push (PUSH_ENABLED)
  Svc->>DB: INSERT sync_log
```

---

## 4. Data source authority

To prevent conflicts/flapping, the authority for each field is fixed.

| Data | Primary | Fallback | Authority note |
|---|---|---|---|
| Fixtures/groups/venues | openfootball | — | Canonical ID source (seed) |
| Live score/status/minute | ESPN | worldcupjson → football-data | Field-based: this service fixes it |
| Live events (goal/card) | ESPN `/summary` | — | match_events dedup (unique index) |
| Officials | football-data | API-Football | Pre-match cron, idempotent |
| Lineups | ESPN `/summary` rosters | — | Pre-match cron |
| Standings | **computed** | — | Derived from match results |
| Content (profile/guide/H2H/visa) | wc26-mcp | — | Static seed (MIT) |
| Multilingual name | REST Countries | hard-code (ENG/SCO) | Seed-time |

---

## 5. Knockout linker (resolveTarget)

Once the group stage ends, ESPN publishes the knockout teams. Our knockout matches
start with `home_team_id`/`away_team_id` = NULL (placeholder "2A"). Matching:

```mermaid
flowchart TD
  U["ESPN update<br/>(homeFifa, awayFifa, kickoffUtc)"] --> ID{"sourceIds.espn<br/>matches?"}
  ID -- yes --> M1["match (id)"]
  ID -- no --> PAIR{"FIFA-pair<br/>matches?"}
  PAIR -- yes --> M2["match (group)"]
  PAIR -- no --> KO{"kickoff-time<br/>single match?"}
  KO -- "1 candidate" --> M3["knockout slot<br/>→ ASSIGN teams + stamp espn id"]
  KO -- ">1 candidate" --> AMB["ambiguous → skip + warn"]
  KO -- "0 candidates" --> NONE["none → skip"]
```

In the real 2026 calendar no knockout match shares the same kickoff moment →
no ambiguity risk (verified). After the first assignment `sourceIds.espn` is stamped,
so subsequent syncs match by `id`.
</content>
</invoke>
