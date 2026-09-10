import { PrismaClient, TableOperationalStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAreasAndTables() {
  const branches = await prisma.branch.findMany();
  console.log(`Found ${branches.length} branches to seed tables for.`);

  for (const branch of branches) {
    // 1. Create Areas
    const mainDining = await prisma.restaurantArea.create({
      data: {
        branchId: branch.id,
        name: 'Trong nhà (Main Dining)',
        description: 'Không gian ấm cúng, sang trọng giữa lòng nhà hàng.',
        sortOrder: 1,
      },
    });

    const windowView = await prisma.restaurantArea.create({
      data: {
        branchId: branch.id,
        name: 'Cạnh cửa sổ (Window View)',
        description: 'Tầm nhìn thoáng đãng ngắm phố phường lãng mạn.',
        sortOrder: 2,
      },
    });

    const outdoor = await prisma.restaurantArea.create({
      data: {
        branchId: branch.id,
        name: 'Ngoài trời (Outdoor Terrace)',
        description: 'Không gian sân vườn thoáng mát, lãng đãng dưới ánh đèn.',
        sortOrder: 3,
      },
    });

    const vipRoom = await prisma.restaurantArea.create({
      data: {
        branchId: branch.id,
        name: 'Phòng VIP riêng (Private VIP Room)',
        description: 'Không gian riêng tư tuyệt đối cho tiệc gia đình và tiếp khách.',
        sortOrder: 4,
      },
    });

    // 2. Create Tables
    const tablesData = [
      // Main Dining: 4 tables for 2, 4 tables for 4, 2 tables for 6
      { code: 'M-01', name: 'Bàn M01', capacity: 2, minCapacity: 1, areaId: mainDining.id },
      { code: 'M-02', name: 'Bàn M02', capacity: 2, minCapacity: 1, areaId: mainDining.id },
      { code: 'M-03', name: 'Bàn M03', capacity: 2, minCapacity: 1, areaId: mainDining.id },
      { code: 'M-04', name: 'Bàn M04', capacity: 2, minCapacity: 1, areaId: mainDining.id },
      { code: 'M-05', name: 'Bàn M05', capacity: 4, minCapacity: 2, areaId: mainDining.id },
      { code: 'M-06', name: 'Bàn M06', capacity: 4, minCapacity: 2, areaId: mainDining.id },
      { code: 'M-07', name: 'Bàn M07', capacity: 4, minCapacity: 2, areaId: mainDining.id },
      { code: 'M-08', name: 'Bàn M08', capacity: 4, minCapacity: 2, areaId: mainDining.id },
      { code: 'M-09', name: 'Bàn M09', capacity: 6, minCapacity: 4, areaId: mainDining.id },
      { code: 'M-10', name: 'Bàn M10', capacity: 6, minCapacity: 4, areaId: mainDining.id },

      // Window View: 3 tables for 2, 3 tables for 4
      { code: 'W-01', name: 'Bàn Cửa Sổ W01', capacity: 2, minCapacity: 1, areaId: windowView.id },
      { code: 'W-02', name: 'Bàn Cửa Sổ W02', capacity: 2, minCapacity: 1, areaId: windowView.id },
      { code: 'W-03', name: 'Bàn Cửa Sổ W03', capacity: 2, minCapacity: 1, areaId: windowView.id },
      { code: 'W-04', name: 'Bàn Cửa Sổ W04', capacity: 4, minCapacity: 2, areaId: windowView.id },
      { code: 'W-05', name: 'Bàn Cửa Sổ W05', capacity: 4, minCapacity: 2, areaId: windowView.id },
      { code: 'W-06', name: 'Bàn Cửa Sổ W06', capacity: 4, minCapacity: 2, areaId: windowView.id },

      // Outdoor Terrace: 2 tables for 2, 2 tables for 4, 1 table for 8
      { code: 'O-01', name: 'Bàn Sân Vườn O01', capacity: 2, minCapacity: 1, areaId: outdoor.id },
      { code: 'O-02', name: 'Bàn Sân Vườn O02', capacity: 2, minCapacity: 1, areaId: outdoor.id },
      { code: 'O-03', name: 'Bàn Sân Vườn O03', capacity: 4, minCapacity: 2, areaId: outdoor.id },
      { code: 'O-04', name: 'Bàn Sân Vườn O04', capacity: 4, minCapacity: 2, areaId: outdoor.id },
      { code: 'O-05', name: 'Bàn Sân Vườn O05', capacity: 8, minCapacity: 5, areaId: outdoor.id },

      // VIP Room: VIP 1 (8 seats), VIP 2 (12 seats)
      { code: 'VIP-01', name: 'Phòng VIP Hoàng Gia', capacity: 8, minCapacity: 4, areaId: vipRoom.id },
      { code: 'VIP-02', name: 'Phòng VIP Thượng Uyển', capacity: 12, minCapacity: 6, areaId: vipRoom.id },
    ];

    let sortOrder = 1;
    for (const t of tablesData) {
      await prisma.restaurantTable.create({
        data: {
          branchId: branch.id,
          areaId: t.areaId,
          tableCode: t.code,
          name: t.name,
          capacity: t.capacity,
          minCapacity: t.minCapacity,
          status: TableOperationalStatus.ACTIVE,
          sortOrder: sortOrder++,
        },
      });
    }

    // Update branch capacity sum
    const totalCap = tablesData.reduce((acc, cur) => acc + cur.capacity, 0);
    await prisma.branch.update({
      where: { id: branch.id },
      data: {
        capacity: totalCap,
        reservationMode: 'AUTO',
        reservationEnabled: true,
        reservationDurationMinutes: 90,
        reservationBufferMinutes: 15,
        reservationSlotMinutes: 30,
        minPartySize: 1,
        maxPartySize: 30,
      },
    });

    console.log(`Seeded 4 areas and ${tablesData.length} tables for branch ${branch.name} (Capacity: ${totalCap})`);
  }

  console.log('Finished seeding tables & areas!');
}

seedAreasAndTables()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
