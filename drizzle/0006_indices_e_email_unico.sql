ALTER TABLE `users` MODIFY COLUMN `openId` varchar(400) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `iols_manufacturer_idx` ON `iols` (`manufacturerId`);--> statement-breakpoint
CREATE INDEX `measurement_points_measurement_idx` ON `measurement_points` (`measurementId`);--> statement-breakpoint
CREATE INDEX `measurements_patient_idx` ON `measurements` (`patientId`);--> statement-breakpoint
CREATE INDEX `measurements_user_idx` ON `measurements` (`userId`);--> statement-breakpoint
CREATE INDEX `measurements_patient_iol_idx` ON `measurements` (`patientIolId`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_idx` ON `password_reset_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `patient_iols_patient_idx` ON `patient_iols` (`patientId`);--> statement-breakpoint
CREATE INDEX `patient_iols_iol_idx` ON `patient_iols` (`iolId`);--> statement-breakpoint
CREATE INDEX `patients_user_idx` ON `patients` (`userId`);