CREATE TABLE `question_catalog_publications` (
	`catalog_id` text PRIMARY KEY NOT NULL,
	`current_question_id` text NOT NULL,
	`published_by_id` text,
	`published_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`catalog_id`) REFERENCES `question_catalogs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`current_question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`published_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_catalog_publications_current_unique` ON `question_catalog_publications` (`current_question_id`);--> statement-breakpoint
INSERT INTO `question_catalog_publications`
  (`catalog_id`, `current_question_id`, `published_by_id`, `published_at`, `updated_at`)
SELECT q.`question_catalog_id`, q.`id`, NULL, q.`updated_at`, q.`updated_at`
FROM `questions` q
WHERE q.`id` = (
  SELECT latest.`id`
  FROM `questions` latest
  WHERE latest.`question_catalog_id` = q.`question_catalog_id`
    AND latest.`status` = 'published'
  ORDER BY latest.`revision` DESC
  LIMIT 1
);--> statement-breakpoint
ALTER TABLE `questions` ADD `created_by_id` text REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
DROP TABLE `app_schema_marker`;--> statement-breakpoint
CREATE TABLE `app_schema_marker` (
	`version` integer PRIMARY KEY NOT NULL,
	CONSTRAINT "app_schema_marker_version_check" CHECK(`version` = 3)
);--> statement-breakpoint
INSERT INTO `app_schema_marker` (`version`) VALUES (3);
