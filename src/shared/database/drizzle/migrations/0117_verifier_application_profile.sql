-- Dialek, alasan, dan foto diri opsional pada pengajuan verifikator.
-- Kolom nullable: baris yang sudah ada tetap valid.
ALTER TABLE `verifier_applications` ADD `dialect` text;
--> statement-breakpoint
ALTER TABLE `verifier_applications` ADD `dialect_note` text;
--> statement-breakpoint
ALTER TABLE `verifier_applications` ADD `reason` text;
--> statement-breakpoint
ALTER TABLE `verifier_applications` ADD `photo` text;
