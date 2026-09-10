-- AlterTable
ALTER TABLE `Voucher` MODIFY `applicableScope` VARCHAR(191) NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE `PrintTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('RECEIPT', 'TEMP_BILL', 'KITCHEN_TICKET', 'ITEM_LABEL', 'ONLINE_ORDER') NOT NULL,
    `content` LONGTEXT NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `paperSize` VARCHAR(191) NULL DEFAULT '80mm',
    `settings` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PrintTemplate_branchId_idx`(`branchId`),
    INDEX `PrintTemplate_branchId_type_idx`(`branchId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrintTemplateVersion` (
    `id` VARCHAR(191) NOT NULL,
    `printTemplateId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `content` LONGTEXT NOT NULL,
    `paperSize` VARCHAR(191) NULL,
    `settings` JSON NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PrintTemplateVersion_printTemplateId_idx`(`printTemplateId`),
    INDEX `PrintTemplateVersion_printTemplateId_version_idx`(`printTemplateId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PrintTemplate` ADD CONSTRAINT `PrintTemplate_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintTemplateVersion` ADD CONSTRAINT `PrintTemplateVersion_printTemplateId_fkey` FOREIGN KEY (`printTemplateId`) REFERENCES `PrintTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
