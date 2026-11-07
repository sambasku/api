-- Provider WhatsApp pindah dari Kapso ke OpenWA.
UPDATE `wa_usage` SET `provider` = 'openwa' WHERE `provider` = 'kapso';
