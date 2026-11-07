CREATE TYPE "public"."assessment_kind" AS ENUM('mood', 'anxiety', 'self_talk');--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "kind" "assessment_kind" DEFAULT 'mood' NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "moves" jsonb;