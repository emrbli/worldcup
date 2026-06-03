CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"country" text,
	"timezone" text,
	"lat" numeric,
	"lng" numeric
);
--> statement-breakpoint
CREATE TABLE "confederations" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter" char(1),
	"name" text,
	CONSTRAINT "groups_letter_unique" UNIQUE("letter")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_number" integer,
	"stage" text,
	"group_id" uuid,
	"matchday" integer,
	"home_team_id" uuid,
	"away_team_id" uuid,
	"home_placeholder" text,
	"away_placeholder" text,
	"venue_id" uuid,
	"kickoff_utc" timestamp with time zone,
	"status" text DEFAULT 'scheduled',
	"minute" integer,
	"home_score" integer,
	"away_score" integer,
	"home_score_ht" integer,
	"away_score_ht" integer,
	"home_pens" integer,
	"away_pens" integer,
	"source_ids" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "standings" (
	"group_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"played" integer DEFAULT 0,
	"won" integer DEFAULT 0,
	"drawn" integer DEFAULT 0,
	"lost" integer DEFAULT 0,
	"gf" integer DEFAULT 0,
	"ga" integer DEFAULT 0,
	"gd" integer DEFAULT 0,
	"points" integer DEFAULT 0,
	"rank" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "standings_group_id_team_id_pk" PRIMARY KEY("group_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fifa_code" text,
	"iso2" text,
	"name" text,
	"name_i18n" jsonb DEFAULT '{}'::jsonb,
	"confederation" text,
	"group_id" uuid,
	"is_host" boolean DEFAULT false,
	"fifa_ranking" integer,
	"logo_url" text,
	"source_ids" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"fifa_name" text,
	"city_id" uuid,
	"country" text,
	"capacity" integer,
	"lat" numeric,
	"lng" numeric,
	"image_url" text,
	"source_ids" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"key" text PRIMARY KEY NOT NULL,
	"base_url" text,
	"type" text,
	"enabled" boolean DEFAULT true,
	"priority" integer
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text,
	"entity" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"status" text,
	"rows_upserted" integer,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_confederation_confederations_code_fk" FOREIGN KEY ("confederation") REFERENCES "public"."confederations"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_kickoff_utc_idx" ON "matches" USING btree ("kickoff_utc");--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");