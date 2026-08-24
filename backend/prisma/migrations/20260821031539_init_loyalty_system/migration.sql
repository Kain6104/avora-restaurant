/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[memberCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `notification` ADD COLUMN `url` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `voucherId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `orderitem` ADD COLUMN `flashSaleId` VARCHAR(191) NULL,
    ADD COLUMN `isFlashSaleItem` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `authProvider` ENUM('LOCAL', 'GOOGLE', 'FACEBOOK') NOT NULL DEFAULT 'LOCAL',
    ADD COLUMN `googleId` VARCHAR(191) NULL,
    ADD COLUMN `memberCode` VARCHAR(50) NULL,
    MODIFY `passwordHash` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Voucher` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `discountType` ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIP') NOT NULL DEFAULT 'FIXED_AMOUNT',
    `discountValue` DOUBLE NOT NULL,
    `maxDiscount` DOUBLE NULL,
    `minOrderValue` DOUBLE NOT NULL DEFAULT 0,
    `usageLimit` INTEGER NULL,
    `usageLimitPerUser` INTEGER NULL DEFAULT 1,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `membershipTierId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Voucher_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FlashSale` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FlashSaleItem` (
    `id` VARCHAR(191) NOT NULL,
    `flashSaleId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `flashSalePrice` DOUBLE NOT NULL,
    `stock` INTEGER NOT NULL,
    `sold` INTEGER NOT NULL DEFAULT 0,
    `maxQuantityPerUser` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MembershipTier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `minSpending` DOUBLE NOT NULL DEFAULT 0,
    `pointMultiplier` DOUBLE NOT NULL DEFAULT 1.0,
    `discountPercent` DOUBLE NOT NULL DEFAULT 0.0,
    `imageUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MembershipTier_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PointTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `membershipTierId` VARCHAR(191) NULL,
    `membershipTierName` VARCHAR(191) NULL,
    `balanceBefore` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `source` ENUM('ORDER', 'REWARD', 'SYSTEM', 'ADMIN', 'BONUS', 'BIRTHDAY', 'REFUND', 'EXPIRED', 'PROMOTION') NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `orderCode` VARCHAR(191) NULL,
    `referenceCode` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PointTransaction_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `PointTransaction_userId_source_idx`(`userId`, `source`),
    INDEX `PointTransaction_userId_membershipTierId_idx`(`userId`, `membershipTierId`),
    INDEX `PointTransaction_orderCode_idx`(`orderCode`),
    INDEX `PointTransaction_orderId_idx`(`orderId`),
    INDEX `PointTransaction_referenceCode_idx`(`referenceCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_googleId_key` ON `User`(`googleId`);

-- CreateIndex
CREATE UNIQUE INDEX `User_memberCode_key` ON `User`(`memberCode`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_membershipTierId_fkey` FOREIGN KEY (`membershipTierId`) REFERENCES `MembershipTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_membershipTierId_fkey` FOREIGN KEY (`membershipTierId`) REFERENCES `MembershipTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlashSaleItem` ADD CONSTRAINT `FlashSaleItem_flashSaleId_fkey` FOREIGN KEY (`flashSaleId`) REFERENCES `FlashSale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlashSaleItem` ADD CONSTRAINT `FlashSaleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointTransaction` ADD CONSTRAINT `PointTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointTransaction` ADD CONSTRAINT `PointTransaction_membershipTierId_fkey` FOREIGN KEY (`membershipTierId`) REFERENCES `MembershipTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointTransaction` ADD CONSTRAINT `PointTransaction_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
