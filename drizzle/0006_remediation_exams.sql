CREATE TABLE `remediation_exam_targets` (
	`exam_id` text NOT NULL,
	`category` text NOT NULL,
	`position` integer NOT NULL,
	`question_count` integer NOT NULL,
	PRIMARY KEY(`exam_id`, `category`),
	FOREIGN KEY (`exam_id`) REFERENCES `remediation_exams`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "remediation_exam_targets_count_check" CHECK("remediation_exam_targets"."question_count" in (5, 10))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `remediation_exam_targets_position_unique` ON `remediation_exam_targets` (`exam_id`,`position`);--> statement-breakpoint
CREATE TABLE `remediation_exams` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`quiz_set_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`weakness_fingerprint` text NOT NULL,
	`report_start_at` integer NOT NULL,
	`report_end_exclusive_at` integer NOT NULL,
	`report_data_cutoff_at` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`quiz_set_id`) REFERENCES `quiz_sets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "remediation_exams_status_check" CHECK("remediation_exams"."status" in ('in_progress', 'completed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `remediation_exams_in_progress_fingerprint_unique` ON `remediation_exams` (`learner_id`,`weakness_fingerprint`) WHERE "remediation_exams"."status" = 'in_progress';--> statement-breakpoint
CREATE UNIQUE INDEX `remediation_exams_quiz_set_unique` ON `remediation_exams` (`quiz_set_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `remediation_exams_attempt_unique` ON `remediation_exams` (`attempt_id`);--> statement-breakpoint
DROP TABLE `app_schema_marker`;--> statement-breakpoint
CREATE TABLE `app_schema_marker` (`version` integer PRIMARY KEY NOT NULL, CONSTRAINT `app_schema_marker_version_check` CHECK(`version` = 5));--> statement-breakpoint
INSERT INTO `app_schema_marker` (`version`) VALUES (5);
