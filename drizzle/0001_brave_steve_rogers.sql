CREATE TABLE "question_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_reviews_question_hash_unique" UNIQUE("question_id","content_hash")
);
--> statement-breakpoint
ALTER TABLE "evaluation_reports" ADD COLUMN "recommendations" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "question_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "assignment_id" uuid;--> statement-breakpoint
ALTER TABLE "quiz_sets" ADD COLUMN "knowledge_version_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_sets" ADD COLUMN "quiz_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_sets" ADD COLUMN "source_quiz_hash" text;--> statement-breakpoint
ALTER TABLE "quiz_sets" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD COLUMN "version_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD COLUMN "summary" text NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD COLUMN "customer_turns" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD COLUMN "scoring_dimensions" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD COLUMN "critical_risks" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD COLUMN "reference_flow" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD COLUMN "sources" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD COLUMN "mock_mode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "scenario_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "mode" text DEFAULT 'mock' NOT NULL;--> statement-breakpoint
ALTER TABLE "question_reviews" ADD CONSTRAINT "question_reviews_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reviews" ADD CONSTRAINT "question_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_reviews_reviewer_created_idx" ON "question_reviews" USING btree ("reviewer_id","created_at");--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sets" ADD CONSTRAINT "quiz_sets_knowledge_version_id_knowledge_versions_id_fk" FOREIGN KEY ("knowledge_version_id") REFERENCES "public"."knowledge_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_version_key_unique" UNIQUE("knowledge_version_id","question_key");--> statement-breakpoint
ALTER TABLE "quiz_sets" ADD CONSTRAINT "quiz_sets_hash_unique" UNIQUE("quiz_hash");--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD CONSTRAINT "scenario_versions_key_unique" UNIQUE("version_key");--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_key_unique" UNIQUE("scenario_key");--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD CONSTRAINT "scenario_versions_mock_mode_check" CHECK ("scenario_versions"."mock_mode" = true);--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_mock_mode_check" CHECK ("training_sessions"."mode" = 'mock');