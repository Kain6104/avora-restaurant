-- AlterTable
ALTER TABLE `FlashSale` ADD COLUMN `applyOnline` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `applyPos` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `printVersion` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `printedQuantity` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `sentQuantity` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Voucher` ADD COLUMN `appliesToAllPaymentMethods` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `VoucherPaymentMethod` (
    `voucherId` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,

    INDEX `VoucherPaymentMethod_paymentMethodId_idx`(`paymentMethodId`),
    PRIMARY KEY (`voucherId`, `paymentMethodId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KitchenStation` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KitchenStation_branchId_idx`(`branchId`),
    UNIQUE INDEX `KitchenStation_branchId_code_key`(`branchId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Printer` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `connectionType` ENUM('NETWORK_DIRECT', 'PRINT_AGENT') NOT NULL DEFAULT 'NETWORK_DIRECT',
    `payloadType` ENUM('ESC_POS', 'HTML', 'PDF', 'ZPL') NOT NULL DEFAULT 'ESC_POS',
    `ipAddress` VARCHAR(191) NULL,
    `port` INTEGER NOT NULL DEFAULT 9100,
    `agentId` VARCHAR(191) NULL,
    `paperSize` VARCHAR(191) NOT NULL DEFAULT '80mm',
    `labelWidthMm` INTEGER NULL,
    `labelHeightMm` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('ONLINE', 'OFFLINE', 'ERROR') NOT NULL DEFAULT 'ONLINE',
    `lastSeenAt` DATETIME(3) NULL,
    `lastPrintAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Printer_branchId_idx`(`branchId`),
    INDEX `Printer_agentId_idx`(`agentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrintAgent` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `agentCode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `secretHash` VARCHAR(191) NOT NULL,
    `salt` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `ipAddress` VARCHAR(191) NULL,
    `version` VARCHAR(191) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PrintAgent_agentCode_key`(`agentCode`),
    INDEX `PrintAgent_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KitchenStationPrinter` (
    `id` VARCHAR(191) NOT NULL,
    `stationId` VARCHAR(191) NOT NULL,
    `printerId` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `printPurpose` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KitchenStationPrinter_stationId_idx`(`stationId`),
    INDEX `KitchenStationPrinter_printerId_idx`(`printerId`),
    UNIQUE INDEX `KitchenStationPrinter_stationId_printerId_key`(`stationId`, `printerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductPrintRoute` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `stationId` VARCHAR(191) NOT NULL,
    `routeRole` ENUM('PREPARATION', 'LABEL', 'EXPEDITOR') NOT NULL DEFAULT 'PREPARATION',
    `printType` ENUM('RECEIPT', 'TEMP_BILL', 'KITCHEN_TICKET', 'ITEM_LABEL', 'ONLINE_ORDER') NOT NULL DEFAULT 'KITCHEN_TICKET',
    `copies` INTEGER NOT NULL DEFAULT 1,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductPrintRoute_productId_branchId_idx`(`productId`, `branchId`),
    INDEX `ProductPrintRoute_branchId_idx`(`branchId`),
    INDEX `ProductPrintRoute_stationId_idx`(`stationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrintJob` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `stationId` VARCHAR(191) NOT NULL,
    `printerId` VARCHAR(191) NOT NULL,
    `printTemplateId` VARCHAR(191) NULL,
    `routeId` VARCHAR(191) NULL,
    `routeRole` ENUM('PREPARATION', 'LABEL', 'EXPEDITOR') NOT NULL DEFAULT 'PREPARATION',
    `payloadType` ENUM('ESC_POS', 'HTML', 'PDF', 'ZPL') NOT NULL DEFAULT 'ESC_POS',
    `printType` ENUM('RECEIPT', 'TEMP_BILL', 'KITCHEN_TICKET', 'ITEM_LABEL', 'ONLINE_ORDER') NOT NULL DEFAULT 'KITCHEN_TICKET',
    `eventType` ENUM('NEW_ITEM', 'ADD_QUANTITY', 'CANCEL_ITEM', 'RETURN_ITEM', 'ITEM_LABEL', 'REPRINT') NOT NULL DEFAULT 'NEW_ITEM',
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `quantityDelta` INTEGER NOT NULL DEFAULT 1,
    `printedQtyBefore` INTEGER NOT NULL DEFAULT 0,
    `copies` INTEGER NOT NULL DEFAULT 1,
    `contentHtml` LONGTEXT NOT NULL,
    `payloadData` LONGTEXT NULL,
    `snapshotData` JSON NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'DISPATCHED', 'PRINTED', 'FAILED', 'UNKNOWN', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `errorMessage` TEXT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `reprintOfId` VARCHAR(191) NULL,
    `reprintReason` TEXT NULL,
    `reprintedBy` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `printedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PrintJob_idempotencyKey_key`(`idempotencyKey`),
    INDEX `PrintJob_branchId_status_idx`(`branchId`, `status`),
    INDEX `PrintJob_orderId_idx`(`orderId`),
    INDEX `PrintJob_orderItemId_idx`(`orderItemId`),
    INDEX `PrintJob_printerId_idx`(`printerId`),
    INDEX `PrintJob_reprintOfId_idx`(`reprintOfId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KitchenEvent` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `stationId` VARCHAR(191) NULL,
    `eventType` ENUM('NEW_ITEM', 'ADD_QUANTITY', 'CANCEL_ITEM', 'RETURN_ITEM', 'ITEM_LABEL', 'REPRINT') NOT NULL,
    `itemSummary` JSON NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KitchenEvent_orderId_idx`(`orderId`),
    INDEX `KitchenEvent_branchId_createdAt_idx`(`branchId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VoucherPaymentMethod` ADD CONSTRAINT `VoucherPaymentMethod_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherPaymentMethod` ADD CONSTRAINT `VoucherPaymentMethod_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `PaymentMethod`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenStation` ADD CONSTRAINT `KitchenStation_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Printer` ADD CONSTRAINT `Printer_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Printer` ADD CONSTRAINT `Printer_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `PrintAgent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintAgent` ADD CONSTRAINT `PrintAgent_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenStationPrinter` ADD CONSTRAINT `KitchenStationPrinter_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `KitchenStation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenStationPrinter` ADD CONSTRAINT `KitchenStationPrinter_printerId_fkey` FOREIGN KEY (`printerId`) REFERENCES `Printer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductPrintRoute` ADD CONSTRAINT `ProductPrintRoute_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductPrintRoute` ADD CONSTRAINT `ProductPrintRoute_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductPrintRoute` ADD CONSTRAINT `ProductPrintRoute_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `KitchenStation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintJob` ADD CONSTRAINT `PrintJob_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintJob` ADD CONSTRAINT `PrintJob_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintJob` ADD CONSTRAINT `PrintJob_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintJob` ADD CONSTRAINT `PrintJob_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `KitchenStation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintJob` ADD CONSTRAINT `PrintJob_printerId_fkey` FOREIGN KEY (`printerId`) REFERENCES `Printer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintJob` ADD CONSTRAINT `PrintJob_printTemplateId_fkey` FOREIGN KEY (`printTemplateId`) REFERENCES `PrintTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenEvent` ADD CONSTRAINT `KitchenEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenEvent` ADD CONSTRAINT `KitchenEvent_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenEvent` ADD CONSTRAINT `KitchenEvent_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `KitchenStation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

