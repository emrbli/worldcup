CREATE TABLE "bracket_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round" text,
	"position" integer,
	"match_id" uuid,
	"home_source" text,
	"away_source" text
);
--> statement-breakpoint
ALTER TABLE "bracket_slots" ADD CONSTRAINT "bracket_slots_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;