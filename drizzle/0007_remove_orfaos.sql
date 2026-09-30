-- Limpeza única de registros órfãos deixados pela exclusão de pacientes antes
-- da correção em deletePatient (que agora apaga em cascata numa transação).
DELETE FROM `measurement_points` WHERE `measurementId` NOT IN (SELECT `id` FROM `measurements`) OR `measurementId` IN (SELECT m.`id` FROM `measurements` m LEFT JOIN `patients` p ON p.`id` = m.`patientId` WHERE p.`id` IS NULL);--> statement-breakpoint
DELETE m FROM `measurements` m LEFT JOIN `patients` p ON p.`id` = m.`patientId` WHERE p.`id` IS NULL;--> statement-breakpoint
DELETE pi FROM `patient_iols` pi LEFT JOIN `patients` p ON p.`id` = pi.`patientId` WHERE p.`id` IS NULL;
