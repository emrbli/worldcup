ALTER TABLE "matches" ADD COLUMN "result_type" text DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "decided_by" text;--> statement-breakpoint
ALTER TABLE "standings" ADD COLUMN "fair_play_points" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "standings" ADD COLUMN "points_adjustment" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "standings" ADD COLUMN "manual_rank" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "bracket_slots" ADD COLUMN "override_winner_team_id" uuid;--> statement-breakpoint
ALTER TABLE "team_profiles" ADD COLUMN "coach_nationality" text;--> statement-breakpoint
ALTER TABLE "bracket_slots" ADD CONSTRAINT "bracket_slots_override_winner_team_id_teams_id_fk" FOREIGN KEY ("override_winner_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;