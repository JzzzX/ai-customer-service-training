CREATE TYPE "public"."assignment_status" AS ENUM('assigned', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."assignment_type" AS ENUM('quiz', 'scenario');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."evaluation_verdict" AS ENUM('passed', 'needs_retry');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_kind" AS ENUM('markdown', 'excel', 'mindmap');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_status" AS ENUM('draft', 'published', 'disabled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."message_sender" AS ENUM('customer', 'learner', 'coach', 'system');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('single_choice', 'true_false');--> statement-breakpoint
CREATE TYPE "public"."quiz_attempt_status" AS ENUM('in_progress', 'passed', 'needs_retry');--> statement-breakpoint
CREATE TYPE "public"."review_decision_status" AS ENUM('confirmed', 'adjusted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."review_trigger" AS ENUM('failed', 'critical_risk', 'low_confidence', 'random_sample');--> statement-breakpoint
CREATE TYPE "public"."training_session_status" AS ENUM('in_progress', 'completed', 'needs_review', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'learner');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"assigned_by_id" uuid NOT NULL,
	"assignment_type" "assignment_type" NOT NULL,
	"quiz_set_id" uuid,
	"scenario_version_id" uuid,
	"status" "assignment_status" DEFAULT 'assigned' NOT NULL,
	"due_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_target_check" CHECK ((
        ("assignments"."assignment_type" = 'quiz' and "assignments"."quiz_set_id" is not null and "assignments"."scenario_version_id" is null)
        or
        ("assignments"."assignment_type" = 'scenario' and "assignments"."quiz_set_id" is null and "assignments"."scenario_version_id" is not null)
      ))
);
--> statement-breakpoint
CREATE TABLE "evaluation_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_session_id" uuid NOT NULL,
	"knowledge_version_id" uuid NOT NULL,
	"total_score" integer NOT NULL,
	"verdict" "evaluation_verdict" NOT NULL,
	"dimensions" jsonb NOT NULL,
	"strengths" jsonb NOT NULL,
	"omissions" jsonb NOT NULL,
	"risks" jsonb NOT NULL,
	"turn_feedback" jsonb NOT NULL,
	"recommended_flow" jsonb NOT NULL,
	"sample_reply" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_trigger" "review_trigger",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluation_reports_session_unique" UNIQUE("training_session_id"),
	CONSTRAINT "evaluation_reports_score_check" CHECK ("evaluation_reports"."total_score" between 0 and 100),
	CONSTRAINT "evaluation_reports_confidence_check" CHECK ("evaluation_reports"."confidence" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_version_id" uuid NOT NULL,
	"source_path" text NOT NULL,
	"kind" "knowledge_source_kind" NOT NULL,
	"source_hash" text NOT NULL,
	"bytes" integer NOT NULL,
	"stats" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_sources_version_path_unique" UNIQUE("knowledge_version_id","source_path")
);
--> statement-breakpoint
CREATE TABLE "knowledge_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_version_id" uuid NOT NULL,
	"unit_key" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category_path" jsonb NOT NULL,
	"semantic_key" text,
	"content_hash" text NOT NULL,
	"sources" jsonb NOT NULL,
	"has_conflict" boolean DEFAULT false NOT NULL,
	"can_use_for_quiz" boolean DEFAULT true NOT NULL,
	"can_use_for_scenario" boolean DEFAULT true NOT NULL,
	"can_use_for_evaluation" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_units_version_key_unique" UNIQUE("knowledge_version_id","unit_key")
);
--> statement-breakpoint
CREATE TABLE "knowledge_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_hash" text NOT NULL,
	"schema_version" integer NOT NULL,
	"source_root" text NOT NULL,
	"status" "lifecycle_status" DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"coverage" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_versions_hash_unique" UNIQUE("version_hash")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_version_id" uuid NOT NULL,
	"knowledge_unit_id" uuid NOT NULL,
	"type" "question_type" NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_answers" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"category" text NOT NULL,
	"difficulty" "difficulty" DEFAULT 'easy' NOT NULL,
	"status" "lifecycle_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_answers" jsonb NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_answers_attempt_question_unique" UNIQUE("quiz_attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_set_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"knowledge_version_id" uuid NOT NULL,
	"status" "quiz_attempt_status" DEFAULT 'in_progress' NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"total_questions" integer NOT NULL,
	"score" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "quiz_attempts_score_check" CHECK ("quiz_attempts"."score" is null or "quiz_attempts"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "quiz_set_questions" (
	"quiz_set_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "quiz_set_questions_pk" PRIMARY KEY("quiz_set_id","question_id"),
	CONSTRAINT "quiz_set_questions_position_unique" UNIQUE("quiz_set_id","position")
);
--> statement-breakpoint
CREATE TABLE "quiz_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "lifecycle_status" DEFAULT 'draft' NOT NULL,
	"passing_score" integer DEFAULT 80 NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_sets_passing_score_check" CHECK ("quiz_sets"."passing_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "review_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_report_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"status" "review_decision_status" NOT NULL,
	"corrected_verdict" "evaluation_verdict",
	"corrected_score" integer,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_decisions_corrected_score_check" CHECK ("review_decisions"."corrected_score" is null or "review_decisions"."corrected_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "scenario_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"knowledge_version_id" uuid NOT NULL,
	"background" text NOT NULL,
	"first_customer_message" text NOT NULL,
	"controlled_variables" jsonb NOT NULL,
	"hidden_facts" jsonb NOT NULL,
	"checkpoints" jsonb NOT NULL,
	"prohibitions" jsonb NOT NULL,
	"scoring_weights" jsonb NOT NULL,
	"reference_reply" text NOT NULL,
	"max_turns" integer DEFAULT 12 NOT NULL,
	"status" "lifecycle_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_versions_number_unique" UNIQUE("scenario_id","version"),
	CONSTRAINT "scenario_versions_max_turns_check" CHECK ("scenario_versions"."max_turns" between 8 and 16)
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"status" "lifecycle_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"sender" "message_sender" NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_messages_session_position_unique" UNIQUE("training_session_id","position")
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid,
	"learner_id" uuid NOT NULL,
	"knowledge_version_id" uuid NOT NULL,
	"scenario_version_id" uuid NOT NULL,
	"status" "training_session_status" DEFAULT 'in_progress' NOT NULL,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'learner' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_quiz_set_id_quiz_sets_id_fk" FOREIGN KEY ("quiz_set_id") REFERENCES "public"."quiz_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_scenario_version_id_scenario_versions_id_fk" FOREIGN KEY ("scenario_version_id") REFERENCES "public"."scenario_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_reports" ADD CONSTRAINT "evaluation_reports_training_session_id_training_sessions_id_fk" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_reports" ADD CONSTRAINT "evaluation_reports_knowledge_version_id_knowledge_versions_id_fk" FOREIGN KEY ("knowledge_version_id") REFERENCES "public"."knowledge_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_knowledge_version_id_knowledge_versions_id_fk" FOREIGN KEY ("knowledge_version_id") REFERENCES "public"."knowledge_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_units" ADD CONSTRAINT "knowledge_units_knowledge_version_id_knowledge_versions_id_fk" FOREIGN KEY ("knowledge_version_id") REFERENCES "public"."knowledge_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_knowledge_version_id_knowledge_versions_id_fk" FOREIGN KEY ("knowledge_version_id") REFERENCES "public"."knowledge_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_knowledge_unit_id_knowledge_units_id_fk" FOREIGN KEY ("knowledge_unit_id") REFERENCES "public"."knowledge_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_quiz_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("quiz_attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_set_id_quiz_sets_id_fk" FOREIGN KEY ("quiz_set_id") REFERENCES "public"."quiz_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_knowledge_version_id_knowledge_versions_id_fk" FOREIGN KEY ("knowledge_version_id") REFERENCES "public"."knowledge_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_set_questions" ADD CONSTRAINT "quiz_set_questions_quiz_set_id_quiz_sets_id_fk" FOREIGN KEY ("quiz_set_id") REFERENCES "public"."quiz_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_set_questions" ADD CONSTRAINT "quiz_set_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sets" ADD CONSTRAINT "quiz_sets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_evaluation_report_id_evaluation_reports_id_fk" FOREIGN KEY ("evaluation_report_id") REFERENCES "public"."evaluation_reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD CONSTRAINT "scenario_versions_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD CONSTRAINT "scenario_versions_knowledge_version_id_knowledge_versions_id_fk" FOREIGN KEY ("knowledge_version_id") REFERENCES "public"."knowledge_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_versions" ADD CONSTRAINT "scenario_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_messages" ADD CONSTRAINT "training_messages_training_session_id_training_sessions_id_fk" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_knowledge_version_id_knowledge_versions_id_fk" FOREIGN KEY ("knowledge_version_id") REFERENCES "public"."knowledge_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_scenario_version_id_scenario_versions_id_fk" FOREIGN KEY ("scenario_version_id") REFERENCES "public"."scenario_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_learner_status_idx" ON "assignments" USING btree ("learner_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_units_semantic_key_idx" ON "knowledge_units" USING btree ("semantic_key");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_versions_single_active_idx" ON "knowledge_versions" USING btree ("is_active") WHERE "knowledge_versions"."is_active" = true;--> statement-breakpoint
CREATE INDEX "questions_knowledge_unit_idx" ON "questions" USING btree ("knowledge_unit_id");--> statement-breakpoint
CREATE INDEX "questions_status_category_idx" ON "questions" USING btree ("status","category");--> statement-breakpoint
CREATE INDEX "quiz_attempts_learner_started_idx" ON "quiz_attempts" USING btree ("learner_id","started_at");--> statement-breakpoint
CREATE INDEX "review_decisions_report_created_idx" ON "review_decisions" USING btree ("evaluation_report_id","created_at");--> statement-breakpoint
CREATE INDEX "training_sessions_learner_started_idx" ON "training_sessions" USING btree ("learner_id","started_at");