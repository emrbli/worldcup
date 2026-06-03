CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid,
	"scope" text,
	"market" text,
	"channel" text,
	"kind" text,
	"url" text,
	"language" text,
	"logo_url" text,
	"source_ids" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournament_leaders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text,
	"scope" text,
	"team_id" uuid,
	"player_id" uuid,
	"player_name" text,
	"team_name" text,
	"rank" integer,
	"value" numeric,
	"detail" jsonb DEFAULT '{}'::jsonb,
	"source" text,
	"source_ids" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_leaders" ADD CONSTRAINT "tournament_leaders_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_leaders" ADD CONSTRAINT "tournament_leaders_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broadcasts_market_idx" ON "broadcasts" USING btree ("market");--> statement-breakpoint
CREATE UNIQUE INDEX "broadcasts_match_market_channel_uq" ON "broadcasts" USING btree ("match_id","market","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_leaders_category_rank_uq" ON "tournament_leaders" USING btree ("category","rank");