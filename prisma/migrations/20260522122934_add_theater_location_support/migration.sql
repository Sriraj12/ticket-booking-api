-- AlterTable
ALTER TABLE `Theater` ADD COLUMN `formatted_address` VARCHAR(191) NULL,
    ADD COLUMN `google_place_id` VARCHAR(191) NULL,
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL;

-- CreateIndex
CREATE INDEX `Theater_latitude_longitude_idx` ON `Theater`(`latitude`, `longitude`);
