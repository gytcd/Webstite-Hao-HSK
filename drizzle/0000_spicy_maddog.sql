CREATE TABLE `study_records` (
	`user_id` text NOT NULL,
	`record_key` text NOT NULL,
	`value` text NOT NULL,
	`stamp` integer NOT NULL,
	`actor` text NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `record_key`)
);
