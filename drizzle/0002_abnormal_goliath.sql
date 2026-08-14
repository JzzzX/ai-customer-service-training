CREATE TABLE `feishu_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`union_id` text NOT NULL,
	`open_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feishu_identities_open_idx` ON `feishu_identities` (`open_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `feishu_identities_user_unique` ON `feishu_identities` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `feishu_identities_union_unique` ON `feishu_identities` (`union_id`);