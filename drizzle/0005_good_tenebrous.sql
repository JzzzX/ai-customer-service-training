CREATE TABLE `quiz_attempt_questions` (
	`quiz_attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`quiz_attempt_id`, `question_id`),
	FOREIGN KEY (`quiz_attempt_id`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_attempt_questions_position_unique` ON `quiz_attempt_questions` (`quiz_attempt_id`,`position`);--> statement-breakpoint
DROP TABLE `app_schema_marker`;--> statement-breakpoint
CREATE TABLE `app_schema_marker` (
	`version` integer PRIMARY KEY NOT NULL,
	CONSTRAINT "app_schema_marker_version_check" CHECK(`version` = 4)
);--> statement-breakpoint
INSERT INTO `app_schema_marker` (`version`) VALUES (4);
