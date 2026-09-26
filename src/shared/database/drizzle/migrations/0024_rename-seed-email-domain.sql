-- Domain email seed & user sistem: @email.com / @iamutaki.com → @sambasku.com.
-- Idempotent: baris yang sudah pakai domain baru tidak berubah.
UPDATE `users` SET `email` = 'admin@sambasku.com' WHERE `email` = 'admin@email.com';
--> statement-breakpoint
UPDATE `users` SET `email` = 'root@sambasku.com' WHERE `email` = 'root@email.com';
--> statement-breakpoint
UPDATE `users` SET `email` = 'contributor@sambasku.com' WHERE `email` = 'contributor@email.com';
--> statement-breakpoint
UPDATE `users` SET `email` = 'reviewer@sambasku.com' WHERE `email` = 'reviewer@email.com';
--> statement-breakpoint
UPDATE `users` SET `email` = 'anonim@sambasku.com' WHERE `email` = 'anonim@iamutaki.com';
--> statement-breakpoint
UPDATE `users` SET `email` = 'importir-csv@sambasku.com' WHERE `email` = 'importir-csv@iamutaki.com';
