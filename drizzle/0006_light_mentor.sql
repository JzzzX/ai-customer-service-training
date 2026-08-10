CREATE TABLE "topic_quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_quiz_attempt_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"selected_answers" jsonb NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_quiz_answers_attempt_question_unique" UNIQUE("topic_quiz_attempt_id","question_key")
);
--> statement-breakpoint
CREATE TABLE "topic_quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"topic_id" text NOT NULL,
	"quiz_hash" text NOT NULL,
	"status" "quiz_attempt_status" NOT NULL,
	"correct_count" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"score" integer NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_quiz_attempts_score_check" CHECK ("topic_quiz_attempts"."score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "topic_quiz_answers" ADD CONSTRAINT "topic_quiz_answers_topic_quiz_attempt_id_topic_quiz_attempts_id_fk" FOREIGN KEY ("topic_quiz_attempt_id") REFERENCES "public"."topic_quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_quiz_attempts" ADD CONSTRAINT "topic_quiz_attempts_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topic_quiz_attempts_learner_completed_idx" ON "topic_quiz_attempts" USING btree ("learner_id","completed_at");--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_mode_check" CHECK ("training_sessions"."mode" in ('mock', 'real'));
