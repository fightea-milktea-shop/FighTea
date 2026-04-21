-- ============================================================
-- FighTea — Master Database Schema  v4
-- File: /database/schema.sql
-- Run this FIRST before any other SQL file.
-- ============================================================

CREATE DATABASE IF NOT EXISTS `fightea_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `fightea_db`;

-- ── USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `full_name`     VARCHAR(120)  NOT NULL,
  `email`         VARCHAR(180)  NOT NULL UNIQUE,
  `phone`         VARCHAR(20)   DEFAULT NULL,
  `password_hash` VARCHAR(255)  NOT NULL,
  `role`          ENUM('customer','admin','staff') NOT NULL DEFAULT 'customer',
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`),
  INDEX `idx_role`  (`role`)
) ENGINE=InnoDB;

-- ── SESSIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sessions` (
  `id`         VARCHAR(128) PRIMARY KEY,
  `user_id`    INT UNSIGNED NOT NULL,
  `ip_address` VARCHAR(45)  DEFAULT NULL,
  `expires_at` TIMESTAMP    NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id`    (`user_id`),
  INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB;

-- ── CATEGORIES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `categories` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(80)  NOT NULL UNIQUE,
  `slug`       VARCHAR(80)  NOT NULL UNIQUE,
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1)  NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ── PRODUCTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `products` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `category_id`   INT UNSIGNED  NOT NULL,
  `name`          VARCHAR(120)  NOT NULL,
  `description`   TEXT          DEFAULT NULL,
  `base_price`    DECIMAL(8,2)  NOT NULL,
  `image_url`     TEXT          DEFAULT NULL,
  `emoji`         VARCHAR(10)   DEFAULT 'ICON',
  `is_available`  TINYINT(1)   NOT NULL DEFAULT 1,
  `is_bestseller` TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`),
  INDEX `idx_category` (`category_id`)
) ENGINE=InnoDB;

-- ── SIZE OPTIONS (fixed — not admin-editable) ─────────────
CREATE TABLE IF NOT EXISTS `size_options` (
  `id`        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `label`     VARCHAR(20)  NOT NULL UNIQUE,
  `price_add` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `sort_order`TINYINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ── ICE OPTIONS (fixed — not admin-editable) ──────────────
CREATE TABLE IF NOT EXISTS `ice_options` (
  `id`        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `label`     VARCHAR(20) NOT NULL UNIQUE,
  `sort_order`TINYINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- NOTE: sugar_options table REMOVED in v4 per spec.

-- ── TOPPINGS (admin-editable) ─────────────────────────────
CREATE TABLE IF NOT EXISTS `toppings` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(80)  NOT NULL UNIQUE,
  `emoji`       VARCHAR(10)  DEFAULT NULL,
  `price`       DECIMAL(6,2) NOT NULL DEFAULT 15.00,
  `is_available`TINYINT(1)  NOT NULL DEFAULT 1,
  `sort_order`  TINYINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ── ORDERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `orders` (
  `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_number`   VARCHAR(20)  NOT NULL UNIQUE,
  `user_id`        INT UNSIGNED DEFAULT NULL,
  `customer_name`  VARCHAR(120) NOT NULL,
  `customer_phone` VARCHAR(20)  DEFAULT NULL,
  `status`         ENUM('pending','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'pending',
  `payment_method` ENUM('cash','gcash') NOT NULL DEFAULT 'cash',
  `payment_status` ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
  `gcash_ref`      VARCHAR(50)  DEFAULT NULL,
  `subtotal`       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `discount`       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total`          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `notes`          TEXT          DEFAULT NULL,
  `assigned_staff` INT UNSIGNED  DEFAULT NULL,
  `order_date`     DATE          NOT NULL DEFAULT (CURRENT_DATE),
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`)        REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_staff`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_status`     (`status`),
  INDEX `idx_order_date` (`order_date`),
  INDEX `idx_order_num`  (`order_number`)
) ENGINE=InnoDB;

-- ── ORDER ITEMS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_items` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id`    INT UNSIGNED  NOT NULL,
  `product_id`  INT UNSIGNED  DEFAULT NULL,
  `product_name`VARCHAR(120)  NOT NULL,
  `size_id`     INT UNSIGNED  DEFAULT NULL,
  `size_label`  VARCHAR(20)   DEFAULT NULL,
  `size_price`  DECIMAL(6,2)  NOT NULL DEFAULT 0.00,
  `ice_label`   VARCHAR(20)   DEFAULT NULL,
  `quantity`    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `unit_price`  DECIMAL(8,2)  NOT NULL,
  `line_total`  DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_order_id` (`order_id`)
) ENGINE=InnoDB;

-- ── ORDER ITEM TOPPINGS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_item_toppings` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_item_id` INT UNSIGNED NOT NULL,
  `topping_id`    INT UNSIGNED DEFAULT NULL,
  `topping_name`  VARCHAR(80)  NOT NULL,
  `price`         DECIMAL(6,2) NOT NULL DEFAULT 15.00,
  FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── ORDER STATUS LOG ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_status_log` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id`   INT UNSIGNED NOT NULL,
  `old_status` VARCHAR(20)  DEFAULT NULL,
  `new_status` VARCHAR(20)  NOT NULL,
  `changed_by` INT UNSIGNED DEFAULT NULL,
  `note`       TEXT         DEFAULT NULL,
  `changed_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`)   REFERENCES `orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── PAYMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payments` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id`     INT UNSIGNED  NOT NULL UNIQUE,
  `method`       ENUM('cash','gcash') NOT NULL,
  `amount_paid`  DECIMAL(10,2) NOT NULL,
  `change_given` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `gcash_number` VARCHAR(15)   DEFAULT NULL,
  `gcash_ref`    VARCHAR(50)   DEFAULT NULL,
  `verified_by`  INT UNSIGNED  DEFAULT NULL,
  `paid_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`)    REFERENCES `orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── PRODUCT VARIETIES (v5 — admin-managed per product) ────
CREATE TABLE IF NOT EXISTS `product_varieties` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT UNSIGNED NOT NULL,
  `name`       VARCHAR(80)  NOT NULL,
  `price`      DECIMAL(8,2) NOT NULL,
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  INDEX `idx_product_id` (`product_id`)
) ENGINE=InnoDB;

-- ── ADD has_sizes COLUMN TO PRODUCTS (v5) ─────────────────
ALTER TABLE `products`
  ADD COLUMN `has_sizes` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_bestseller`;

-- ── PROMOS (v5) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `promos` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(120) NOT NULL,
  `badge`       VARCHAR(20)  DEFAULT NULL,
  `description` TEXT         DEFAULT NULL,
  `is_active`   TINYINT(1)  NOT NULL DEFAULT 1,
  `created_at`  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── PROMO ITEMS (v5) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `promo_items` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `promo_id`    INT UNSIGNED NOT NULL,
  `product_id`  INT UNSIGNED NOT NULL,
  `variety_id`  INT UNSIGNED DEFAULT NULL,
  `size_id`     INT UNSIGNED DEFAULT NULL,
  `promo_price` DECIMAL(8,2) NOT NULL,
  FOREIGN KEY (`promo_id`)   REFERENCES `promos`(`id`)           ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)         ON DELETE CASCADE,
  FOREIGN KEY (`variety_id`) REFERENCES `product_varieties`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`size_id`)    REFERENCES `size_options`(`id`)      ON DELETE SET NULL,
  INDEX `idx_promo_id` (`promo_id`)
) ENGINE=InnoDB;
