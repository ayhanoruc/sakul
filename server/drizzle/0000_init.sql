CREATE TABLE `belgeler` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proje_id` integer NOT NULL,
	`tur` text NOT NULL,
	`verilis_tarihi` text,
	`gecerlilik_bitis` text,
	`dosya_id` integer,
	`aciklama` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`proje_id`) REFERENCES `projeler`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dosya_id`) REFERENCES `dosyalar`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `belgeler_proje_idx` ON `belgeler` (`proje_id`);--> statement-breakpoint
CREATE TABLE `cekler` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proje_id` integer,
	`yon` text NOT NULL,
	`karsi_taraf` text NOT NULL,
	`tutar_kurus` integer NOT NULL,
	`vade_tarihi` text NOT NULL,
	`banka` text,
	`cek_no` text,
	`durum` text DEFAULT 'beklemede' NOT NULL,
	`dosya_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`proje_id`) REFERENCES `projeler`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dosya_id`) REFERENCES `dosyalar`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cekler_vade_idx` ON `cekler` (`vade_tarihi`);--> statement-breakpoint
CREATE TABLE `device_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`scopes` text DEFAULT 'notes:write,reminders:write' NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_tokens_token_hash_unique` ON `device_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `dosyalar` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proje_id` integer,
	`orijinal_ad` text NOT NULL,
	`saklanan_yol` text NOT NULL,
	`mime` text NOT NULL,
	`boyut_byte` integer NOT NULL,
	`sha256` text NOT NULL,
	`kategori` text DEFAULT 'diger' NOT NULL,
	`aciklama` text,
	`etiketler` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`proje_id`) REFERENCES `projeler`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dosyalar_saklanan_yol_unique` ON `dosyalar` (`saklanan_yol`);--> statement-breakpoint
CREATE INDEX `dosyalar_proje_idx` ON `dosyalar` (`proje_id`);--> statement-breakpoint
CREATE INDEX `dosyalar_kategori_idx` ON `dosyalar` (`kategori`);--> statement-breakpoint
CREATE TABLE `hakedisler` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proje_id` integer NOT NULL,
	`taseron_id` integer,
	`yon` text NOT NULL,
	`aciklama` text,
	`tutar_kurus` integer NOT NULL,
	`vade_tarihi` text,
	`odendi_mi` integer DEFAULT 0 NOT NULL,
	`odeme_tarihi` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`proje_id`) REFERENCES `projeler`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`taseron_id`) REFERENCES `taseronlar`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hakedisler_proje_idx` ON `hakedisler` (`proje_id`);--> statement-breakpoint
CREATE TABLE `hatirlaticilar` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tur` text NOT NULL,
	`baslik` text NOT NULL,
	`detay` text,
	`proje_id` integer,
	`hatirlatma_zamani` text,
	`tekrar_kurali` text,
	`engelleyen_id` integer,
	`kaynak_tablo` text,
	`kaynak_id` integer,
	`durum` text DEFAULT 'bekliyor' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`proje_id`) REFERENCES `projeler`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hatirlaticilar_due_idx` ON `hatirlaticilar` (`durum`,`hatirlatma_zamani`);--> statement-breakpoint
CREATE UNIQUE INDEX `hatirlaticilar_kaynak_uniq` ON `hatirlaticilar` (`kaynak_tablo`,`kaynak_id`,`hatirlatma_zamani`);--> statement-breakpoint
CREATE TABLE `malzemeler` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proje_id` integer NOT NULL,
	`ad` text NOT NULL,
	`tedarikci` text,
	`miktar` real,
	`birim` text,
	`siparis_tarihi` text,
	`teslim_tarihi` text,
	`teslim_alindi_mi` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`proje_id`) REFERENCES `projeler`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `malzemeler_proje_idx` ON `malzemeler` (`proje_id`);--> statement-breakpoint
CREATE TABLE `notlar` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proje_id` integer,
	`icerik` text NOT NULL,
	`kaynak` text DEFAULT 'pwa' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`proje_id`) REFERENCES `projeler`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notlar_proje_idx` ON `notlar` (`proje_id`);--> statement-breakpoint
CREATE TABLE `projeler` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ad` text NOT NULL,
	`adres` text,
	`ada_parsel` text,
	`mal_sahibi` text,
	`durum` text DEFAULT 'aktif' NOT NULL,
	`baslangic_tarihi` text,
	`aciklama` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`last_seen_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `reminder_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hatirlatici_id` integer NOT NULL,
	`sent_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`channel` text NOT NULL,
	`success` integer NOT NULL,
	`error` text,
	FOREIGN KEY (`hatirlatici_id`) REFERENCES `hatirlaticilar`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `taseronlar` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proje_id` integer,
	`ad` text NOT NULL,
	`is_kolu` text,
	`telefon` text,
	`anlasilan_tutar_kurus` integer,
	`aciklama` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`proje_id`) REFERENCES `projeler`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);