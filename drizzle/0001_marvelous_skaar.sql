CREATE TABLE `iols` (
	`id` int AUTO_INCREMENT NOT NULL,
	`manufacturerId` int NOT NULL,
	`model` varchar(128) NOT NULL,
	`type` enum('monofocal','bifocal','trifocal','edof','toric') NOT NULL DEFAULT 'trifocal',
	`material` varchar(64),
	`opticDesign` varchar(128),
	`powerRange` varchar(64),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `iols_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manufacturers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`country` varchar(64),
	`website` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manufacturers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measurement_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`measurementId` int NOT NULL,
	`diopter` decimal(4,2) NOT NULL,
	`visualAcuity` decimal(4,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `measurement_points_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`patientIolId` int,
	`userId` int NOT NULL,
	`measurementDate` date NOT NULL,
	`eye` enum('OD','OS','OU') NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `measurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patient_iols` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`iolId` int NOT NULL,
	`eye` enum('OD','OS','OU') NOT NULL,
	`surgeryDate` date,
	`refractiveTarget` decimal(4,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patient_iols_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`birthDate` date,
	`cpf` varchar(14),
	`phone` varchar(20),
	`email` varchar(320),
	`notes` text,
	`lgpdConsent` boolean NOT NULL DEFAULT false,
	`lgpdConsentDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`)
);
