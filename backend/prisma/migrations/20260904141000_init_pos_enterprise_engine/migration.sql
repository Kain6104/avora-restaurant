-- DropForeignKey
ALTER TABLE `Order` DROP FOREIGN KEY `Order_userId_fkey`;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `cashierId` VARCHAR(191) NULL,
    ADD COLUMN `guestCount` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `kitchenReadyAt` DATETIME(3) NULL,
    ADD COLUMN `kitchenStatus` ENUM('PENDING', 'SENT', 'ACKNOWLEDGED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `orderSource` ENUM('WEB', 'POS', 'CHATBOT', 'VOICE', 'QR_ORDER', 'ADMIN') NOT NULL DEFAULT 'WEB',
    ADD COLUMN `sentToKitchenAt` DATETIME(3) NULL,
    ADD COLUMN `servedAt` DATETIME(3) NULL,
    ADD COLUMN `tableId` VARCHAR(191) NULL,
    ADD COLUMN `tableSessionId` VARCHAR(191) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
    MODIFY `userId` VARCHAR(191) NULL,
    MODIFY `deliveryAddress` TEXT NULL,
    MODIFY `status` ENUM('DRAFT', 'HELD', 'PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `acknowledgedAt` DATETIME(3) NULL,
    ADD COLUMN `isKitchenPrinted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `kitchenStatus` ENUM('PENDING', 'SENT', 'ACKNOWLEDGED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `readyAt` DATETIME(3) NULL,
    ADD COLUMN `sentToKitchenAt` DATETIME(3) NULL,
    ADD COLUMN `servedAt` DATETIME(3) NULL,
    ADD COLUMN `stationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `RestaurantTable` ADD COLUMN `height` DOUBLE NULL DEFAULT 80,
    ADD COLUMN `shape` VARCHAR(191) NULL DEFAULT 'RECTANGLE',
    ADD COLUMN `width` DOUBLE NULL DEFAULT 80,
    ADD COLUMN `x` DOUBLE NULL DEFAULT 0,
    ADD COLUMN `y` DOUBLE NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `OrderRelation` (
    `id` VARCHAR(191) NOT NULL,
    `parentOrderId` VARCHAR(191) NOT NULL,
    `childOrderId` VARCHAR(191) NOT NULL,
    `type` ENUM('SPLIT_FROM', 'MERGED_INTO') NOT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderRelation_parentOrderId_idx`(`parentOrderId`),
    INDEX `OrderRelation_childOrderId_idx`(`childOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItemTransferLog` (
    `id` VARCHAR(191) NOT NULL,
    `sourceOrderId` VARCHAR(191) NOT NULL,
    `targetOrderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `sourceItemSnapshot` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderItemTransferLog_sourceOrderId_idx`(`sourceOrderId`),
    INDEX `OrderItemTransferLog_targetOrderId_idx`(`targetOrderId`),
    INDEX `OrderItemTransferLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TableSession` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `tableId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `guestCount` INTEGER NOT NULL DEFAULT 1,
    `cashierId` VARCHAR(191) NULL,

    INDEX `TableSession_branchId_tableId_status_idx`(`branchId`, `tableId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderPayment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `paymentMethod` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'COMPLETED',
    `transactionRef` VARCHAR(191) NULL,
    `cashReceived` DOUBLE NULL,
    `cashChange` DOUBLE NULL,
    `cardType` VARCHAR(191) NULL,
    `cardLast4` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `cashierId` VARCHAR(191) NULL,
    `shiftId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderPayment_orderId_idx`(`orderId`),
    INDEX `OrderPayment_shiftId_idx`(`shiftId`),
    INDEX `OrderPayment_paymentMethod_idx`(`paymentMethod`),
    INDEX `OrderPayment_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentRefund` (
    `id` VARCHAR(191) NOT NULL,
    `orderPaymentId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `reason` TEXT NULL,
    `cashierId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaymentRefund_orderPaymentId_idx`(`orderPaymentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashShift` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `cashierId` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `openingBalance` DOUBLE NOT NULL DEFAULT 0,
    `closingBalance` DOUBLE NULL,
    `expectedBalance` DOUBLE NULL,
    `cashDifference` DOUBLE NULL,
    `totalRevenue` DOUBLE NOT NULL DEFAULT 0,
    `totalCash` DOUBLE NOT NULL DEFAULT 0,
    `totalCard` DOUBLE NOT NULL DEFAULT 0,
    `totalTransfer` DOUBLE NOT NULL DEFAULT 0,
    `orderCount` INTEGER NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `openedById` VARCHAR(191) NOT NULL,
    `closedById` VARCHAR(191) NULL,

    INDEX `CashShift_branchId_cashierId_status_idx`(`branchId`, `cashierId`, `status`),
    INDEX `CashShift_openedAt_idx`(`openedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IdempotencyRecord` (
    `key` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `response` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `IdempotencyRecord_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Order_tableSessionId_key` ON `Order`(`tableSessionId`);

-- CreateIndex
CREATE INDEX `Order_tableId_idx` ON `Order`(`tableId`);

-- CreateIndex
CREATE INDEX `Order_cashierId_idx` ON `Order`(`cashierId`);

-- CreateIndex
CREATE INDEX `Order_orderSource_idx` ON `Order`(`orderSource`);

-- CreateIndex
CREATE INDEX `Order_status_idx` ON `Order`(`status`);

-- CreateIndex
CREATE INDEX `Order_kitchenStatus_idx` ON `Order`(`kitchenStatus`);

-- CreateIndex
CREATE INDEX `OrderItem_kitchenStatus_idx` ON `OrderItem`(`kitchenStatus`);

-- CreateIndex
CREATE INDEX `OrderItem_stationId_idx` ON `OrderItem`(`stationId`);

-- CreateIndex
CREATE INDEX `Reservation_branchId_fkey` ON `Reservation`(`branchId`);

-- CreateIndex
CREATE INDEX `Reservation_userId_fkey` ON `Reservation`(`userId`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `RestaurantTable`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_tableSessionId_fkey` FOREIGN KEY (`tableSessionId`) REFERENCES `TableSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderRelation` ADD CONSTRAINT `OrderRelation_parentOrderId_fkey` FOREIGN KEY (`parentOrderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderRelation` ADD CONSTRAINT `OrderRelation_childOrderId_fkey` FOREIGN KEY (`childOrderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TableSession` ADD CONSTRAINT `TableSession_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `RestaurantTable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TableSession` ADD CONSTRAINT `TableSession_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderPayment` ADD CONSTRAINT `OrderPayment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderPayment` ADD CONSTRAINT `OrderPayment_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `CashShift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentRefund` ADD CONSTRAINT `PaymentRefund_orderPaymentId_fkey` FOREIGN KEY (`orderPaymentId`) REFERENCES `OrderPayment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashShift` ADD CONSTRAINT `CashShift_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashShift` ADD CONSTRAINT `CashShift_cashierId_fkey` FOREIGN KEY (`cashierId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashShift` ADD CONSTRAINT `CashShift_openedById_fkey` FOREIGN KEY (`openedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashShift` ADD CONSTRAINT `CashShift_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

