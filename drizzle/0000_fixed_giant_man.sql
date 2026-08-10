CREATE TABLE `evaluation_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`training_session_id` text NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`total_score` integer NOT NULL,
	`verdict` text NOT NULL,
	`dimensions` text NOT NULL,
	`strengths` text NOT NULL,
	`omissions` text NOT NULL,
	`risks` text NOT NULL,
	`recommendations` text NOT NULL,
	`turn_feedback` text NOT NULL,
	`recommended_flow` text NOT NULL,
	`sample_reply` text NOT NULL,
	`evidence` text NOT NULL,
	`confidence` real NOT NULL,
	`low_confidence` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`training_session_id`) REFERENCES `training_sessions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evaluation_reports_score_check" CHECK("evaluation_reports"."total_score" between 0 and 100),
	CONSTRAINT "evaluation_reports_confidence_check" CHECK("evaluation_reports"."confidence" between 0 and 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_reports_session_unique` ON `evaluation_reports` (`training_session_id`);--> statement-breakpoint
CREATE TABLE `knowledge_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`source_path` text NOT NULL,
	`kind` text NOT NULL,
	`source_hash` text NOT NULL,
	`bytes` integer NOT NULL,
	`stats` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_sources_version_path_unique` ON `knowledge_sources` (`knowledge_version_id`,`source_path`);--> statement-breakpoint
CREATE TABLE `knowledge_units` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`unit_key` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`category_path` text NOT NULL,
	`semantic_key` text,
	`content_hash` text NOT NULL,
	`sources` text NOT NULL,
	`has_conflict` integer DEFAULT false NOT NULL,
	`can_use_for_quiz` integer DEFAULT true NOT NULL,
	`can_use_for_scenario` integer DEFAULT true NOT NULL,
	`can_use_for_evaluation` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `knowledge_units_semantic_key_idx` ON `knowledge_units` (`semantic_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_units_version_key_unique` ON `knowledge_units` (`knowledge_version_id`,`unit_key`);--> statement-breakpoint
CREATE TABLE `knowledge_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`version_hash` text NOT NULL,
	`content_hash` text NOT NULL,
	`schema_version` integer NOT NULL,
	`source_root` text NOT NULL,
	`publication_source` text DEFAULT 'cli' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`coverage` text NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "knowledge_versions_publication_source_check" CHECK("knowledge_versions"."publication_source" = 'cli')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_versions_single_active_idx` ON `knowledge_versions` (`is_active`) WHERE "knowledge_versions"."is_active" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_versions_hash_unique` ON `knowledge_versions` (`version_hash`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`knowledge_unit_id` text NOT NULL,
	`question_key` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text NOT NULL,
	`correct_answers` text NOT NULL,
	`explanation` text NOT NULL,
	`category` text NOT NULL,
	`difficulty` text DEFAULT 'easy' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`knowledge_unit_id`) REFERENCES `knowledge_units`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `questions_knowledge_unit_idx` ON `questions` (`knowledge_unit_id`);--> statement-breakpoint
CREATE INDEX `questions_status_category_idx` ON `questions` (`status`,`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `questions_version_key_unique` ON `questions` (`knowledge_version_id`,`question_key`);--> statement-breakpoint
CREATE TABLE `quiz_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_answers` text NOT NULL,
	`is_correct` integer NOT NULL,
	`answered_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`quiz_attempt_id`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_answers_attempt_question_unique` ON `quiz_answers` (`quiz_attempt_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_set_id` text NOT NULL,
	`learner_id` text NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`total_questions` integer NOT NULL,
	`score` integer,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`quiz_set_id`) REFERENCES `quiz_sets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "quiz_attempts_score_check" CHECK("quiz_attempts"."score" is null or "quiz_attempts"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE INDEX `quiz_attempts_learner_started_idx` ON `quiz_attempts` (`learner_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `quiz_set_questions` (
	`quiz_set_id` text NOT NULL,
	`question_id` text NOT NULL,
	`position` integer NOT NULL,
	`points` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`quiz_set_id`, `question_id`),
	FOREIGN KEY (`quiz_set_id`) REFERENCES `quiz_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_set_questions_position_unique` ON `quiz_set_questions` (`quiz_set_id`,`position`);--> statement-breakpoint
CREATE TABLE `quiz_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`quiz_hash` text NOT NULL,
	`content_hash` text NOT NULL,
	`source_quiz_hash` text,
	`title` text NOT NULL,
	`description` text,
	`publication_source` text DEFAULT 'cli' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`passing_score` integer DEFAULT 80 NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "quiz_sets_passing_score_check" CHECK("quiz_sets"."passing_score" between 0 and 100),
	CONSTRAINT "quiz_sets_publication_source_check" CHECK("quiz_sets"."publication_source" = 'cli')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_sets_hash_unique` ON `quiz_sets` (`quiz_hash`);--> statement-breakpoint
CREATE TABLE `scenario_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`version_key` text NOT NULL,
	`version` integer NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`publication_source` text DEFAULT 'cli' NOT NULL,
	`background` text NOT NULL,
	`summary` text NOT NULL,
	`first_customer_message` text NOT NULL,
	`controlled_variables` text NOT NULL,
	`hidden_facts` text NOT NULL,
	`customer_turns` text NOT NULL,
	`checkpoints` text NOT NULL,
	`prohibitions` text NOT NULL,
	`scoring_weights` text NOT NULL,
	`scoring_dimensions` text NOT NULL,
	`critical_risks` text NOT NULL,
	`reference_flow` text NOT NULL,
	`reference_reply` text NOT NULL,
	`sources` text NOT NULL,
	`max_turns` integer DEFAULT 12 NOT NULL,
	`mock_mode` integer DEFAULT true NOT NULL,
	`customer_persona` text,
	`difficulty` text DEFAULT 'medium',
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "scenario_versions_max_turns_check" CHECK("scenario_versions"."max_turns" between 8 and 16),
	CONSTRAINT "scenario_versions_publication_source_check" CHECK("scenario_versions"."publication_source" = 'cli')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenario_versions_key_unique` ON `scenario_versions` (`version_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `scenario_versions_number_unique` ON `scenario_versions` (`scenario_id`,`version`);--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_key` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenarios_key_unique` ON `scenarios` (`scenario_key`);--> statement-breakpoint
CREATE TABLE `topic_quiz_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_quiz_attempt_id` text NOT NULL,
	`question_key` text NOT NULL,
	`selected_answers` text NOT NULL,
	`is_correct` integer NOT NULL,
	`answered_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`topic_quiz_attempt_id`) REFERENCES `topic_quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_quiz_answers_attempt_question_unique` ON `topic_quiz_answers` (`topic_quiz_attempt_id`,`question_key`);--> statement-breakpoint
CREATE TABLE `topic_quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`quiz_hash` text NOT NULL,
	`status` text NOT NULL,
	`correct_count` integer NOT NULL,
	`total_questions` integer NOT NULL,
	`score` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "topic_quiz_attempts_score_check" CHECK("topic_quiz_attempts"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE INDEX `topic_quiz_attempts_learner_completed_idx` ON `topic_quiz_attempts` (`learner_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `training_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`training_session_id` text NOT NULL,
	`position` integer NOT NULL,
	`sender` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`training_session_id`) REFERENCES `training_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_messages_session_position_unique` ON `training_messages` (`training_session_id`,`position`);--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`scenario_version_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`mode` text DEFAULT 'mock' NOT NULL,
	`turn_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`scenario_version_id`) REFERENCES `scenario_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "training_sessions_mode_check" CHECK("training_sessions"."mode" in ('mock', 'real'))
);
--> statement-breakpoint
CREATE INDEX `training_sessions_learner_started_idx` ON `training_sessions` (`learner_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);