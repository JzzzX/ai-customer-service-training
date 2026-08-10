PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_evaluation_reports` (
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
	CONSTRAINT "evaluation_reports_score_check" CHECK("__new_evaluation_reports"."total_score" between 0 and 100),
	CONSTRAINT "evaluation_reports_confidence_check" CHECK("__new_evaluation_reports"."confidence" between 0 and 1),
	CONSTRAINT "evaluation_reports_verdict_check" CHECK("__new_evaluation_reports"."verdict" in ('passed', 'needs_retry'))
);
--> statement-breakpoint
INSERT INTO `__new_evaluation_reports`("id", "training_session_id", "knowledge_version_id", "total_score", "verdict", "dimensions", "strengths", "omissions", "risks", "recommendations", "turn_feedback", "recommended_flow", "sample_reply", "evidence", "confidence", "low_confidence", "created_at") SELECT "id", "training_session_id", "knowledge_version_id", "total_score", "verdict", "dimensions", "strengths", "omissions", "risks", "recommendations", "turn_feedback", "recommended_flow", "sample_reply", "evidence", "confidence", "low_confidence", "created_at" FROM `evaluation_reports`;--> statement-breakpoint
DROP TABLE `evaluation_reports`;--> statement-breakpoint
ALTER TABLE `__new_evaluation_reports` RENAME TO `evaluation_reports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_reports_session_unique` ON `evaluation_reports` (`training_session_id`);--> statement-breakpoint
CREATE TABLE `__new_knowledge_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`source_path` text NOT NULL,
	`kind` text NOT NULL,
	`source_hash` text NOT NULL,
	`bytes` integer NOT NULL,
	`stats` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "knowledge_sources_kind_check" CHECK("__new_knowledge_sources"."kind" in ('markdown', 'excel', 'mindmap'))
);
--> statement-breakpoint
INSERT INTO `__new_knowledge_sources`("id", "knowledge_version_id", "source_path", "kind", "source_hash", "bytes", "stats", "created_at") SELECT "id", "knowledge_version_id", "source_path", "kind", "source_hash", "bytes", "stats", "created_at" FROM `knowledge_sources`;--> statement-breakpoint
DROP TABLE `knowledge_sources`;--> statement-breakpoint
ALTER TABLE `__new_knowledge_sources` RENAME TO `knowledge_sources`;--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_sources_version_path_unique` ON `knowledge_sources` (`knowledge_version_id`,`source_path`);--> statement-breakpoint
CREATE TABLE `__new_knowledge_versions` (
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
	CONSTRAINT "knowledge_versions_publication_source_check" CHECK("__new_knowledge_versions"."publication_source" = 'cli'),
	CONSTRAINT "knowledge_versions_status_check" CHECK("__new_knowledge_versions"."status" in ('draft', 'published', 'disabled', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_knowledge_versions`("id", "version_hash", "content_hash", "schema_version", "source_root", "publication_source", "status", "is_active", "coverage", "published_at", "created_at") SELECT "id", "version_hash", "content_hash", "schema_version", "source_root", "publication_source", "status", "is_active", "coverage", "published_at", "created_at" FROM `knowledge_versions`;--> statement-breakpoint
DROP TABLE `knowledge_versions`;--> statement-breakpoint
ALTER TABLE `__new_knowledge_versions` RENAME TO `knowledge_versions`;--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_versions_single_active_idx` ON `knowledge_versions` (`is_active`) WHERE "knowledge_versions"."is_active" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_versions_hash_unique` ON `knowledge_versions` (`version_hash`);--> statement-breakpoint
CREATE TABLE `__new_questions` (
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
	FOREIGN KEY (`knowledge_unit_id`) REFERENCES `knowledge_units`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "questions_type_check" CHECK("__new_questions"."type" in ('single_choice', 'true_false')),
	CONSTRAINT "questions_difficulty_check" CHECK("__new_questions"."difficulty" in ('easy', 'medium', 'hard')),
	CONSTRAINT "questions_status_check" CHECK("__new_questions"."status" in ('draft', 'published', 'disabled', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_questions`("id", "knowledge_version_id", "knowledge_unit_id", "question_key", "type", "prompt", "options", "correct_answers", "explanation", "category", "difficulty", "status", "created_at", "updated_at") SELECT "id", "knowledge_version_id", "knowledge_unit_id", "question_key", "type", "prompt", "options", "correct_answers", "explanation", "category", "difficulty", "status", "created_at", "updated_at" FROM `questions`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;--> statement-breakpoint
CREATE INDEX `questions_knowledge_unit_idx` ON `questions` (`knowledge_unit_id`);--> statement-breakpoint
CREATE INDEX `questions_status_category_idx` ON `questions` (`status`,`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `questions_version_key_unique` ON `questions` (`knowledge_version_id`,`question_key`);--> statement-breakpoint
CREATE TABLE `__new_quiz_attempts` (
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
	CONSTRAINT "quiz_attempts_score_check" CHECK("__new_quiz_attempts"."score" is null or "__new_quiz_attempts"."score" between 0 and 100),
	CONSTRAINT "quiz_attempts_status_check" CHECK("__new_quiz_attempts"."status" in ('in_progress', 'passed', 'needs_retry'))
);
--> statement-breakpoint
INSERT INTO `__new_quiz_attempts`("id", "quiz_set_id", "learner_id", "knowledge_version_id", "status", "correct_count", "total_questions", "score", "started_at", "completed_at") SELECT "id", "quiz_set_id", "learner_id", "knowledge_version_id", "status", "correct_count", "total_questions", "score", "started_at", "completed_at" FROM `quiz_attempts`;--> statement-breakpoint
DROP TABLE `quiz_attempts`;--> statement-breakpoint
ALTER TABLE `__new_quiz_attempts` RENAME TO `quiz_attempts`;--> statement-breakpoint
CREATE INDEX `quiz_attempts_learner_started_idx` ON `quiz_attempts` (`learner_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `__new_quiz_sets` (
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
	CONSTRAINT "quiz_sets_passing_score_check" CHECK("__new_quiz_sets"."passing_score" between 0 and 100),
	CONSTRAINT "quiz_sets_publication_source_check" CHECK("__new_quiz_sets"."publication_source" = 'cli'),
	CONSTRAINT "quiz_sets_status_check" CHECK("__new_quiz_sets"."status" in ('draft', 'published', 'disabled', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_quiz_sets`("id", "knowledge_version_id", "quiz_hash", "content_hash", "source_quiz_hash", "title", "description", "publication_source", "status", "passing_score", "published_at", "created_at", "updated_at") SELECT "id", "knowledge_version_id", "quiz_hash", "content_hash", "source_quiz_hash", "title", "description", "publication_source", "status", "passing_score", "published_at", "created_at", "updated_at" FROM `quiz_sets`;--> statement-breakpoint
DROP TABLE `quiz_sets`;--> statement-breakpoint
ALTER TABLE `__new_quiz_sets` RENAME TO `quiz_sets`;--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_sets_hash_unique` ON `quiz_sets` (`quiz_hash`);--> statement-breakpoint
CREATE TABLE `__new_scenario_versions` (
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
	CONSTRAINT "scenario_versions_max_turns_check" CHECK("__new_scenario_versions"."max_turns" between 8 and 16),
	CONSTRAINT "scenario_versions_publication_source_check" CHECK("__new_scenario_versions"."publication_source" = 'cli'),
	CONSTRAINT "scenario_versions_difficulty_check" CHECK("__new_scenario_versions"."difficulty" in ('easy', 'medium', 'hard')),
	CONSTRAINT "scenario_versions_status_check" CHECK("__new_scenario_versions"."status" in ('draft', 'published', 'disabled', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_scenario_versions`("id", "scenario_id", "version_key", "version", "knowledge_version_id", "content_hash", "publication_source", "background", "summary", "first_customer_message", "controlled_variables", "hidden_facts", "customer_turns", "checkpoints", "prohibitions", "scoring_weights", "scoring_dimensions", "critical_risks", "reference_flow", "reference_reply", "sources", "max_turns", "mock_mode", "customer_persona", "difficulty", "status", "published_at", "created_at") SELECT "id", "scenario_id", "version_key", "version", "knowledge_version_id", "content_hash", "publication_source", "background", "summary", "first_customer_message", "controlled_variables", "hidden_facts", "customer_turns", "checkpoints", "prohibitions", "scoring_weights", "scoring_dimensions", "critical_risks", "reference_flow", "reference_reply", "sources", "max_turns", "mock_mode", "customer_persona", "difficulty", "status", "published_at", "created_at" FROM `scenario_versions`;--> statement-breakpoint
DROP TABLE `scenario_versions`;--> statement-breakpoint
ALTER TABLE `__new_scenario_versions` RENAME TO `scenario_versions`;--> statement-breakpoint
CREATE UNIQUE INDEX `scenario_versions_key_unique` ON `scenario_versions` (`version_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `scenario_versions_number_unique` ON `scenario_versions` (`scenario_id`,`version`);--> statement-breakpoint
CREATE TABLE `__new_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_key` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "scenarios_status_check" CHECK("__new_scenarios"."status" in ('draft', 'published', 'disabled', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_scenarios`("id", "scenario_key", "title", "category", "status", "created_at", "updated_at") SELECT "id", "scenario_key", "title", "category", "status", "created_at", "updated_at" FROM `scenarios`;--> statement-breakpoint
DROP TABLE `scenarios`;--> statement-breakpoint
ALTER TABLE `__new_scenarios` RENAME TO `scenarios`;--> statement-breakpoint
CREATE UNIQUE INDEX `scenarios_key_unique` ON `scenarios` (`scenario_key`);--> statement-breakpoint
CREATE TABLE `__new_topic_quiz_attempts` (
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
	CONSTRAINT "topic_quiz_attempts_score_check" CHECK("__new_topic_quiz_attempts"."score" between 0 and 100),
	CONSTRAINT "topic_quiz_attempts_status_check" CHECK("__new_topic_quiz_attempts"."status" in ('in_progress', 'passed', 'needs_retry'))
);
--> statement-breakpoint
INSERT INTO `__new_topic_quiz_attempts`("id", "learner_id", "topic_id", "quiz_hash", "status", "correct_count", "total_questions", "score", "completed_at", "created_at") SELECT "id", "learner_id", "topic_id", "quiz_hash", "status", "correct_count", "total_questions", "score", "completed_at", "created_at" FROM `topic_quiz_attempts`;--> statement-breakpoint
DROP TABLE `topic_quiz_attempts`;--> statement-breakpoint
ALTER TABLE `__new_topic_quiz_attempts` RENAME TO `topic_quiz_attempts`;--> statement-breakpoint
CREATE INDEX `topic_quiz_attempts_learner_completed_idx` ON `topic_quiz_attempts` (`learner_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `__new_training_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`training_session_id` text NOT NULL,
	`position` integer NOT NULL,
	`sender` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`training_session_id`) REFERENCES `training_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "training_messages_sender_check" CHECK("__new_training_messages"."sender" in ('customer', 'learner', 'coach', 'system'))
);
--> statement-breakpoint
INSERT INTO `__new_training_messages`("id", "training_session_id", "position", "sender", "content", "metadata", "created_at") SELECT "id", "training_session_id", "position", "sender", "content", "metadata", "created_at" FROM `training_messages`;--> statement-breakpoint
DROP TABLE `training_messages`;--> statement-breakpoint
ALTER TABLE `__new_training_messages` RENAME TO `training_messages`;--> statement-breakpoint
CREATE UNIQUE INDEX `training_messages_session_position_unique` ON `training_messages` (`training_session_id`,`position`);--> statement-breakpoint
CREATE TABLE `__new_training_sessions` (
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
	CONSTRAINT "training_sessions_mode_check" CHECK("__new_training_sessions"."mode" in ('mock', 'real')),
	CONSTRAINT "training_sessions_status_check" CHECK("__new_training_sessions"."status" in ('in_progress', 'completed', 'needs_review', 'failed'))
);
--> statement-breakpoint
INSERT INTO `__new_training_sessions`("id", "learner_id", "knowledge_version_id", "scenario_version_id", "status", "mode", "turn_count", "last_error", "started_at", "completed_at", "updated_at") SELECT "id", "learner_id", "knowledge_version_id", "scenario_version_id", "status", "mode", "turn_count", "last_error", "started_at", "completed_at", "updated_at" FROM `training_sessions`;--> statement-breakpoint
DROP TABLE `training_sessions`;--> statement-breakpoint
ALTER TABLE `__new_training_sessions` RENAME TO `training_sessions`;--> statement-breakpoint
CREATE INDEX `training_sessions_learner_started_idx` ON `training_sessions` (`learner_id`,`started_at`);
--> statement-breakpoint
CREATE TABLE `app_schema_marker` (
	`version` integer PRIMARY KEY NOT NULL,
	CONSTRAINT "app_schema_marker_version_check" CHECK(`version` = 1)
);
--> statement-breakpoint
INSERT INTO `app_schema_marker` (`version`) VALUES (1);
