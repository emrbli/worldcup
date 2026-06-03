CREATE TABLE "match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"type" text NOT NULL,
	"minute" integer,
	"team_id" uuid,
	"player_name" text,
	"detail" jsonb DEFAULT '{}'::jsonb,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "match_events_dedup" UNIQUE("match_id","type","minute","team_id")
);
--> statement-breakpoint
CREATE TABLE "match_lineups" (
	"match_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"formation" text,
	"players" jsonb DEFAULT '[]'::jsonb,
	CONSTRAINT "match_lineups_match_id_team_id_pk" PRIMARY KEY("match_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "match_stats" (
	"match_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "match_stats_match_id_team_id_pk" PRIMARY KEY("match_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"platform" text,
	"country" text,
	"locale" text,
	"timezone" text,
	"push_token" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_seen" timestamp with time zone,
	CONSTRAINT "devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "officials" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_events_match_id_idx" ON "match_events" USING btree ("match_id","created_at");