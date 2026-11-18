-- Repair: pastikan UNIQUE(code) ada (dibutuhkan idempotensi seed/katalog).
-- 0086 sudah membuat index ini; IF NOT EXISTS aman di DB yang index-nya hilang.
CREATE UNIQUE INDEX IF NOT EXISTS `achievements_code_unique` ON `achievements` (`code`);
