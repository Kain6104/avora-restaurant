-- CreateTable
CREATE TABLE `BranchPrinterSetting` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `printerId` VARCHAR(191) NULL,
    `agentPrinterId` VARCHAR(191) NULL,
    `printerName` VARCHAR(191) NOT NULL,
    `driverName` VARCHAR(191) NULL,
    `portName` VARCHAR(191) NULL,
    `paperSize` VARCHAR(191) NOT NULL DEFAULT '80mm',
    `copies` INTEGER NOT NULL DEFAULT 1,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `autoPrint` BOOLEAN NOT NULL DEFAULT false,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BranchPrinterSetting_branchId_idx`(`branchId`),
    INDEX `BranchPrinterSetting_printerId_idx`(`printerId`),
    UNIQUE INDEX `BranchPrinterSetting_branchId_purpose_key`(`branchId`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BranchPrinterSetting` ADD CONSTRAINT `BranchPrinterSetting_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BranchPrinterSetting` ADD CONSTRAINT `BranchPrinterSetting_printerId_fkey` FOREIGN KEY (`printerId`) REFERENCES `Printer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
