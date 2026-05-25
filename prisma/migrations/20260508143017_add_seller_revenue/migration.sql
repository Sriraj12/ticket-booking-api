-- CreateTable
CREATE TABLE `SellerRevenue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `booking_id` INTEGER NOT NULL,
    `seller_id` INTEGER NOT NULL,
    `theater_id` INTEGER NOT NULL,
    `show_id` INTEGER NOT NULL,
    `total_amount` DOUBLE NOT NULL,
    `platform_commission` DOUBLE NOT NULL,
    `seller_earning` DOUBLE NOT NULL,
    `settlement_status` ENUM('PENDING', 'PROCESSING', 'SETTLED') NOT NULL DEFAULT 'PENDING',
    `settled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SellerRevenue_booking_id_key`(`booking_id`),
    INDEX `SellerRevenue_seller_id_idx`(`seller_id`),
    INDEX `SellerRevenue_settlement_status_idx`(`settlement_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SellerRevenue` ADD CONSTRAINT `SellerRevenue_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SellerRevenue` ADD CONSTRAINT `SellerRevenue_seller_id_fkey` FOREIGN KEY (`seller_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SellerRevenue` ADD CONSTRAINT `SellerRevenue_theater_id_fkey` FOREIGN KEY (`theater_id`) REFERENCES `Theater`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SellerRevenue` ADD CONSTRAINT `SellerRevenue_show_id_fkey` FOREIGN KEY (`show_id`) REFERENCES `Show`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
