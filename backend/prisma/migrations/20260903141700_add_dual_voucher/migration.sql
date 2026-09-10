-- AlterTable
ALTER TABLE `Order` ADD COLUMN `shippingDiscount` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `shippingVoucherId` VARCHAR(191) NULL,
    ADD COLUMN `discountVoucherCodeSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `shippingVoucherCodeSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `isVoucherRefunded` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Order_shippingVoucherId_fkey` ON `Order`(`shippingVoucherId`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_shippingVoucherId_fkey` FOREIGN KEY (`shippingVoucherId`) REFERENCES `Voucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
