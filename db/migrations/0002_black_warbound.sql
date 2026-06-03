CREATE TABLE "city_guides" (
	"city_id" uuid PRIMARY KEY NOT NULL,
	"source_venue_id" text,
	"highlights" jsonb DEFAULT '[]'::jsonb,
	"getting_there" jsonb DEFAULT '{}'::jsonb,
	"food_and_drink" jsonb DEFAULT '{}'::jsonb,
	"things_to_do" jsonb DEFAULT '[]'::jsonb,
	"local_tips" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "fan_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid,
	"venue_id" uuid,
	"name" text,
	"address" text,
	"capacity" integer,
	"hours" text,
	"activities" jsonb DEFAULT '[]'::jsonb,
	"transportation" text,
	"free_entry" boolean DEFAULT true,
	"lat" numeric,
	"lng" numeric,
	"source_id" text
);
--> statement-breakpoint
CREATE TABLE "historical_matchups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_a_id" uuid,
	"team_b_id" uuid,
	"total_matches" integer DEFAULT 0,
	"team_a_wins" integer DEFAULT 0,
	"draws" integer DEFAULT 0,
	"team_b_wins" integer DEFAULT 0,
	"total_goals_team_a" integer DEFAULT 0,
	"total_goals_team_b" integer DEFAULT 0,
	"summary" text,
	"aggregate" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"url" text,
	"source" text,
	"summary" text,
	"image_url" text,
	"published_at" timestamp with time zone,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"related_teams" jsonb DEFAULT '[]'::jsonb,
	"source_id" text
);
--> statement-breakpoint
CREATE TABLE "odds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text,
	"match_id" uuid,
	"market" text,
	"selection" text,
	"value" text,
	"implied_probability" text,
	"bookmaker" text,
	"source" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"name" text NOT NULL,
	"position" text,
	"number" integer,
	"club" text,
	"source_ids" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "team_profiles" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"coach" text,
	"style" text,
	"key_players" jsonb DEFAULT '[]'::jsonb,
	"wc_history" text,
	"qualifying_summary" text
);
--> statement-breakpoint
CREATE TABLE "visa_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"nationality" text,
	"passport_country" text,
	"entry_requirements" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
ALTER TABLE "city_guides" ADD CONSTRAINT "city_guides_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_zones" ADD CONSTRAINT "fan_zones_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_zones" ADD CONSTRAINT "fan_zones_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_matchups" ADD CONSTRAINT "historical_matchups_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_matchups" ADD CONSTRAINT "historical_matchups_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odds" ADD CONSTRAINT "odds_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_profiles" ADD CONSTRAINT "team_profiles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_info" ADD CONSTRAINT "visa_info_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;