import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    take: 30,
    select: { id: true, name: true, price: true, imageUrl: true },
  });

  const branches = await prisma.branch.findMany({ select: { id: true } });
  const branchIds = branches.map((b) => ({ id: b.id }));

  console.log(`Found ${products.length} products to build combos.`);

  if (products.length < 4) {
    console.log('Not enough products to build combos.');
    return;
  }

  // Xóa combo test cũ
  await prisma.comboItem.deleteMany({});
  await prisma.combo.deleteMany({});

  const sampleCombos = [
    {
      name: 'Combo Hoàng Gia - Lẩu & Nướng 2 Người',
      description: 'Trải nghiệm ẩm thực thượng hạng với sự kết hợp tuyệt hảo giữa thăn bò nướng mềm mọng, lẩu đậm đà thơm lừng cùng đồ uống tráng miệng cao cấp.',
      price: 499000,
      originalPrice: 650000,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
      isActive: true,
      usageLimit: 100,
      itemIndexes: [0, 1, 2, 3],
    },
    {
      name: 'Combo Tiệc Sum Vầy Gia Đình 4-6 Người',
      description: 'Bữa tiệc ấm cúng thịnh soạn cho cả nhà với đa dạng món khai vị, món chính đặc sắc và nước giải khát thanh mát, tiết kiệm hơn 30%.',
      price: 899000,
      originalPrice: 1250000,
      imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      isActive: true,
      usageLimit: 50,
      itemIndexes: [2, 3, 4, 5, 6],
    },
    {
      name: 'Combo Sashimi & Sushi Thượng Hạng',
      description: 'Tuyệt tác tươi ngon chuẩn Nhật với cá hồi béo ngậy, cá ngừ đại dương, sò điệp và cuộn sushi đặc biệt của bếp trưởng Avora.',
      price: 580000,
      originalPrice: 750000,
      imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop&q=80',
      isActive: true,
      usageLimit: 80,
      itemIndexes: [1, 3, 5],
    },
    {
      name: 'Combo Couple Lãng Mạn Sweet Date',
      description: 'Set ăn tinh tế dành riêng cho 2 người với steak bò mềm tan, salad tươi giòn, tráng miệng ngọt ngào và 2 ly mocktail thượng hạng.',
      price: 399000,
      originalPrice: 520000,
      imageUrl: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&auto=format&fit=crop&q=80',
      isActive: true,
      usageLimit: 120,
      itemIndexes: [0, 2, 4],
    },
  ];

  for (const comboData of sampleCombos) {
    const selectedProducts = comboData.itemIndexes
      .map((idx) => products[idx % products.length])
      .filter(Boolean);

    const combo = await prisma.combo.create({
      data: {
        name: comboData.name,
        description: comboData.description,
        price: comboData.price,
        originalPrice: comboData.originalPrice,
        imageUrl: comboData.imageUrl,
        isActive: comboData.isActive,
        usageLimit: comboData.usageLimit,
        branches: {
          connect: branchIds,
        },
        items: {
          create: selectedProducts.map((p, i) => ({
            productId: p.id,
            quantity: i === 0 ? 2 : 1,
          })),
        },
      },
    });

    console.log(`Created combo: ${combo.name} (${combo.id}) with ${selectedProducts.length} items.`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
