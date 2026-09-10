const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const templates = await prisma.printTemplate.findMany({
    where: { type: 'ONLINE_ORDER' },
  });

  console.log(`Tìm thấy ${templates.length} mẫu in ONLINE_ORDER trong DB.`);

  for (const t of templates) {
    let content = t.content;

    // Thay thế đoạn thuế cũ hoặc [Tien_Thue_VAT]
    if (content.includes('[Tien_Thue_VAT]') || !content.includes('vatExclusive')) {
      const oldVatSection = /<table style="width: 100%; font-size: 12px; margin-top: 4px; border-collapse: collapse;">[\s\S]*?<tr style="border-top: 1px solid #000;/;
      
      const newVatSection = `<table style="width: 100%; font-size: 11.5px; margin-top: 4px; border-collapse: collapse;">
    {{#if vatExclusive}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Tiền hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 2px 0;">Phí giao hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Phi_Giao_Hang]</td>
    </tr>
    {{#if discountVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher món ([Ma_Voucher_Giam_Gia]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Voucher]</td>
    </tr>
    {{/if}}
    {{#if shippingVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher ship ([Ma_Voucher_Freeship]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Freeship]</td>
    </tr>
    {{/if}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Thuế VAT ([Phan_Tram_VAT]):</td>
      <td style="text-align: right; padding: 2px 0; font-weight: bold; white-space: nowrap;">[Tong_VAT]</td>
    </tr>
    [Chi_Tiet_VAT]
    {{/if}}
    {{#if vatInclusive}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Tiền hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 2px 0;">Phí giao hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Phi_Giao_Hang]</td>
    </tr>
    {{#if discountVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher món ([Ma_Voucher_Giam_Gia]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Voucher]</td>
    </tr>
    {{/if}}
    {{#if shippingVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher ship ([Ma_Voucher_Freeship]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Freeship]</td>
    </tr>
    {{/if}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0; font-size: 10.5px; color: #444;">Thuế VAT ([Phan_Tram_VAT] - đã gồm):</td>
      <td style="text-align: right; padding: 1.5px 0; font-size: 10.5px; color: #444; white-space: nowrap;">[Tong_VAT]</td>
    </tr>
    [Chi_Tiet_VAT]
    {{/if}}
    {{#if noVat}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Tiền hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 2px 0;">Phí giao hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Phi_Giao_Hang]</td>
    </tr>
    {{#if discountVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher món ([Ma_Voucher_Giam_Gia]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Voucher]</td>
    </tr>
    {{/if}}
    {{#if shippingVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher ship ([Ma_Voucher_Freeship]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Freeship]</td>
    </tr>
    {{/if}}
    {{/if}}
    <tr style="border-top: 1px solid #000;`;

      if (oldVatSection.test(content)) {
        content = content.replace(oldVatSection, newVatSection);
      } else {
        // Fallback: thay thế trực tiếp thẻ [Tien_Thue_VAT]
        content = content.replace(/\[Tien_Thue_VAT\]/g, '[Tong_VAT]');
      }

      await prisma.printTemplate.update({
        where: { id: t.id },
        data: {
          content,
          version: t.version + 1,
        },
      });

      console.log(`Đã cập nhật template ID: ${t.id} - Chi nhánh: ${t.branchId}`);
    }
  }

  console.log('Hoàn tất cập nhật print templates!');
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
