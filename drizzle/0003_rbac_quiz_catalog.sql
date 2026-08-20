PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'learner' NOT NULL
  CONSTRAINT "users_role_check" CHECK(`role` in ('learner', 'admin'));--> statement-breakpoint
CREATE TABLE `question_catalogs` (
	`id` text PRIMARY KEY NOT NULL,
	`stable_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `question_catalogs_stable_key_unique`
  ON `question_catalogs` (`stable_key`);--> statement-breakpoint
INSERT INTO `question_catalogs` (`id`, `stable_key`, `created_at`)
SELECT
  'qc_legacy_' || `question_key`,
  `question_key`,
  MIN(`created_at`)
FROM `questions`
GROUP BY `question_key`;--> statement-breakpoint
CREATE TABLE `__new_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`question_catalog_id` text NOT NULL,
	`revision` integer NOT NULL,
	`content_hash` text NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`knowledge_unit_id` text,
	`knowledge_unit_key` text NOT NULL,
	`question_key` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text NOT NULL,
	`correct_answers` text NOT NULL,
	`explanation` text NOT NULL,
	`category` text NOT NULL,
	`difficulty` text DEFAULT 'easy' NOT NULL,
	`sources` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`question_catalog_id`) REFERENCES `question_catalogs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`knowledge_unit_id`) REFERENCES `knowledge_units`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "questions_type_check" CHECK(`type` in ('single_choice', 'true_false')),
	CONSTRAINT "questions_difficulty_check" CHECK(`difficulty` in ('easy', 'medium', 'hard')),
	CONSTRAINT "questions_status_check" CHECK(`status` in ('draft', 'published', 'disabled', 'archived')),
	CONSTRAINT "questions_revision_check" CHECK(`revision` >= 1)
);--> statement-breakpoint
INSERT INTO `__new_questions` (
  `id`, `question_catalog_id`, `revision`, `content_hash`,
  `knowledge_version_id`, `knowledge_unit_id`, `knowledge_unit_key`,
  `question_key`, `type`, `prompt`, `options`, `correct_answers`,
  `explanation`, `category`, `difficulty`, `sources`, `status`,
  `created_at`, `updated_at`
)
SELECT
  q.`id`,
  'qc_legacy_' || q.`question_key`,
  ROW_NUMBER() OVER (
    PARTITION BY q.`question_key`
    ORDER BY q.`created_at`, q.`id`
  ),
  'legacy:' || q.`id`,
  q.`knowledge_version_id`,
  q.`knowledge_unit_id`,
  ku.`unit_key`,
  q.`question_key`,
  q.`type`,
  q.`prompt`,
  q.`options`,
  q.`correct_answers`,
  q.`explanation`,
  q.`category`,
  q.`difficulty`,
  ku.`sources`,
  q.`status`,
  q.`created_at`,
  q.`updated_at`
FROM `questions` q
JOIN `knowledge_units` ku ON ku.`id` = q.`knowledge_unit_id`;--> statement-breakpoint
CREATE TABLE `__new_quiz_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_version_id` text NOT NULL,
	`quiz_hash` text NOT NULL,
	`content_hash` text NOT NULL,
	`source_quiz_hash` text,
	`title` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'formal' NOT NULL,
	`topic_id` text,
	`publication_source` text DEFAULT 'cli' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`passing_score` integer DEFAULT 80 NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "quiz_sets_passing_score_check" CHECK(`passing_score` between 0 and 100),
	CONSTRAINT "quiz_sets_publication_source_check" CHECK(`publication_source` = 'cli'),
	CONSTRAINT "quiz_sets_status_check" CHECK(`status` in ('draft', 'published', 'disabled', 'archived')),
	CONSTRAINT "quiz_sets_kind_check" CHECK(`kind` in ('formal', 'topic', 'remediation')),
	CONSTRAINT "quiz_sets_topic_check" CHECK((`kind` = 'topic' and `topic_id` is not null) or (`kind` <> 'topic' and `topic_id` is null))
);--> statement-breakpoint
INSERT INTO `__new_quiz_sets` (
  `id`, `knowledge_version_id`, `quiz_hash`, `content_hash`,
  `source_quiz_hash`, `title`, `description`, `kind`, `topic_id`,
  `publication_source`, `status`, `passing_score`, `published_at`,
  `created_at`, `updated_at`
)
SELECT
  `id`, `knowledge_version_id`, `quiz_hash`, `content_hash`,
  `source_quiz_hash`, `title`, `description`, 'formal', NULL,
  `publication_source`, `status`, `passing_score`, `published_at`,
  `created_at`, `updated_at`
FROM `quiz_sets`;--> statement-breakpoint
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
	FOREIGN KEY (`quiz_set_id`) REFERENCES `__new_quiz_sets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`knowledge_version_id`) REFERENCES `knowledge_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "quiz_attempts_score_check" CHECK(`score` is null or `score` between 0 and 100),
	CONSTRAINT "quiz_attempts_status_check" CHECK(`status` in ('in_progress', 'passed', 'needs_retry'))
);--> statement-breakpoint
INSERT INTO `__new_quiz_attempts` (
  `id`, `quiz_set_id`, `learner_id`, `knowledge_version_id`, `status`,
  `correct_count`, `total_questions`, `score`, `started_at`, `completed_at`
)
SELECT
  `id`, `quiz_set_id`, `learner_id`, `knowledge_version_id`, `status`,
  `correct_count`, `total_questions`, `score`, `started_at`, `completed_at`
FROM `quiz_attempts`;--> statement-breakpoint
CREATE TABLE `__new_quiz_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_answers` text NOT NULL,
	`is_correct` integer NOT NULL,
	`answered_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`quiz_attempt_id`) REFERENCES `__new_quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `__new_questions`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
INSERT INTO `__new_quiz_answers` (
  `id`, `quiz_attempt_id`, `question_id`, `selected_answers`, `is_correct`, `answered_at`
)
SELECT
  `id`, `quiz_attempt_id`, `question_id`, `selected_answers`, `is_correct`, `answered_at`
FROM `quiz_answers`;--> statement-breakpoint
CREATE TABLE `__new_quiz_set_questions` (
	`quiz_set_id` text NOT NULL,
	`question_id` text NOT NULL,
	`position` integer NOT NULL,
	`points` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`quiz_set_id`, `question_id`),
	FOREIGN KEY (`quiz_set_id`) REFERENCES `__new_quiz_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `__new_questions`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
INSERT INTO `__new_quiz_set_questions` (`quiz_set_id`, `question_id`, `position`, `points`)
SELECT `quiz_set_id`, `question_id`, `position`, `points`
FROM `quiz_set_questions`;--> statement-breakpoint
DROP TABLE `quiz_answers`;--> statement-breakpoint
DROP TABLE `quiz_set_questions`;--> statement-breakpoint
DROP TABLE `quiz_attempts`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
DROP TABLE `quiz_sets`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;--> statement-breakpoint
ALTER TABLE `__new_quiz_sets` RENAME TO `quiz_sets`;--> statement-breakpoint
ALTER TABLE `__new_quiz_attempts` RENAME TO `quiz_attempts`;--> statement-breakpoint
ALTER TABLE `__new_quiz_answers` RENAME TO `quiz_answers`;--> statement-breakpoint
ALTER TABLE `__new_quiz_set_questions` RENAME TO `quiz_set_questions`;--> statement-breakpoint
CREATE INDEX `questions_question_key_idx` ON `questions` (`question_key`);--> statement-breakpoint
CREATE INDEX `questions_catalog_idx` ON `questions` (`question_catalog_id`);--> statement-breakpoint
CREATE INDEX `questions_knowledge_unit_idx` ON `questions` (`knowledge_unit_id`);--> statement-breakpoint
CREATE INDEX `questions_status_category_idx` ON `questions` (`status`,`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `questions_catalog_revision_unique`
  ON `questions` (`question_catalog_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `questions_catalog_content_unique`
  ON `questions` (`question_catalog_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `quiz_sets_kind_topic_status_idx`
  ON `quiz_sets` (`kind`,`topic_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_sets_hash_unique` ON `quiz_sets` (`quiz_hash`);--> statement-breakpoint
CREATE INDEX `quiz_attempts_learner_started_idx`
  ON `quiz_attempts` (`learner_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_answers_attempt_question_unique`
  ON `quiz_answers` (`quiz_attempt_id`,`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_set_questions_position_unique`
  ON `quiz_set_questions` (`quiz_set_id`,`position`);--> statement-breakpoint
DROP TABLE `app_schema_marker`;--> statement-breakpoint
CREATE TABLE `app_schema_marker` (
	`version` integer PRIMARY KEY NOT NULL,
	CONSTRAINT "app_schema_marker_version_check" CHECK(`version` = 2)
);--> statement-breakpoint
INSERT INTO `app_schema_marker` (`version`) VALUES (2);--> statement-breakpoint
PRAGMA foreign_keys=ON;
