-- FTS5 search over notlar, dosyalar, projeler — SPEC §5 "Search".
-- Tokenizer is TRIGRAM, not the default unicode61: Turkish agglutination means
-- "beton" must match "betonun/betona/betondan", and there is no Turkish stemmer
-- in SQLite. Trigram does substring matching, which handles suffixes for free.
-- Cost: queries need at least 3 characters.
CREATE VIRTUAL TABLE `search_fts` USING fts5(
  `entity`  UNINDEXED,
  `entity_id` UNINDEXED,
  `content`,
  tokenize = 'trigram'
);
--> statement-breakpoint
-- ---------- notlar ----------
CREATE TRIGGER `notlar_fts_insert` AFTER INSERT ON `notlar` BEGIN
  INSERT INTO `search_fts`(`entity`, `entity_id`, `content`) VALUES ('not', new.`id`, new.`icerik`);
END;
--> statement-breakpoint
CREATE TRIGGER `notlar_fts_update` AFTER UPDATE ON `notlar` BEGIN
  DELETE FROM `search_fts` WHERE `entity` = 'not' AND `entity_id` = old.`id`;
  INSERT INTO `search_fts`(`entity`, `entity_id`, `content`) VALUES ('not', new.`id`, new.`icerik`);
END;
--> statement-breakpoint
CREATE TRIGGER `notlar_fts_delete` AFTER DELETE ON `notlar` BEGIN
  DELETE FROM `search_fts` WHERE `entity` = 'not' AND `entity_id` = old.`id`;
END;
--> statement-breakpoint
-- ---------- dosyalar (name + description + tags in one searchable blob) ----------
CREATE TRIGGER `dosyalar_fts_insert` AFTER INSERT ON `dosyalar` BEGIN
  INSERT INTO `search_fts`(`entity`, `entity_id`, `content`)
  VALUES ('dosya', new.`id`, new.`orijinal_ad` || ' ' || COALESCE(new.`aciklama`, '') || ' ' || COALESCE(new.`etiketler`, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `dosyalar_fts_update` AFTER UPDATE ON `dosyalar` BEGIN
  DELETE FROM `search_fts` WHERE `entity` = 'dosya' AND `entity_id` = old.`id`;
  INSERT INTO `search_fts`(`entity`, `entity_id`, `content`)
  VALUES ('dosya', new.`id`, new.`orijinal_ad` || ' ' || COALESCE(new.`aciklama`, '') || ' ' || COALESCE(new.`etiketler`, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `dosyalar_fts_delete` AFTER DELETE ON `dosyalar` BEGIN
  DELETE FROM `search_fts` WHERE `entity` = 'dosya' AND `entity_id` = old.`id`;
END;
--> statement-breakpoint
-- ---------- projeler ----------
CREATE TRIGGER `projeler_fts_insert` AFTER INSERT ON `projeler` BEGIN
  INSERT INTO `search_fts`(`entity`, `entity_id`, `content`)
  VALUES ('proje', new.`id`, new.`ad` || ' ' || COALESCE(new.`adres`, '') || ' ' || COALESCE(new.`mal_sahibi`, '') || ' ' || COALESCE(new.`ada_parsel`, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `projeler_fts_update` AFTER UPDATE ON `projeler` BEGIN
  DELETE FROM `search_fts` WHERE `entity` = 'proje' AND `entity_id` = old.`id`;
  INSERT INTO `search_fts`(`entity`, `entity_id`, `content`)
  VALUES ('proje', new.`id`, new.`ad` || ' ' || COALESCE(new.`adres`, '') || ' ' || COALESCE(new.`mal_sahibi`, '') || ' ' || COALESCE(new.`ada_parsel`, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `projeler_fts_delete` AFTER DELETE ON `projeler` BEGIN
  DELETE FROM `search_fts` WHERE `entity` = 'proje' AND `entity_id` = old.`id`;
END;
--> statement-breakpoint
-- ---------- backfill existing rows (prod already has data) ----------
INSERT INTO `search_fts`(`entity`, `entity_id`, `content`)
  SELECT 'not', `id`, `icerik` FROM `notlar`;
--> statement-breakpoint
INSERT INTO `search_fts`(`entity`, `entity_id`, `content`)
  SELECT 'dosya', `id`, `orijinal_ad` || ' ' || COALESCE(`aciklama`, '') || ' ' || COALESCE(`etiketler`, '') FROM `dosyalar`;
--> statement-breakpoint
INSERT INTO `search_fts`(`entity`, `entity_id`, `content`)
  SELECT 'proje', `id`, `ad` || ' ' || COALESCE(`adres`, '') || ' ' || COALESCE(`mal_sahibi`, '') || ' ' || COALESCE(`ada_parsel`, '') FROM `projeler`;
