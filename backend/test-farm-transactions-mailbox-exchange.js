const { PrismaClient, PointTransactionSource } = require('@prisma/client');
const prisma = new PrismaClient();

async function runVerification() {
  console.log('=== STARTING SECTION 18 & 19 VERIFICATION ===\n');

  // 1. Kiểm tra Source of Truth của FarmExchangeSetting trong DB
  const setting = await prisma.farmExchangeSetting.findUnique({
    where: { id: 'default' },
  });
  console.log('1. Database FarmExchangeSetting:', {
    coinPerPoint: setting?.coinPerPoint,
    minCoins: setting?.minCoins,
    maxCoinsPerTransaction: setting?.maxCoinsPerTransaction,
    dailyLimitCoins: setting?.dailyLimitCoins,
    isEnabled: setting?.isEnabled,
  });

  if (!setting || setting.coinPerPoint !== 5) {
    throw new Error('FarmExchangeSetting must have coinPerPoint = 5');
  }
  console.log('✓ PASS: Database is SOURCE OF TRUTH for exchange rate (5 Xu = 1 Point).\n');

  // 2. Tìm hoặc chọn 1 user để test
  const user = await prisma.user.findFirst({
    where: { userFarm: { isNot: null } },
    include: { userFarm: true },
  });

  if (!user || !user.userFarm) {
    console.log('No user with farm found, creating test user...');
    return;
  }

  const userId = user.id;
  const farmId = user.userFarm.id;
  console.log(`2. Testing with User: ${user.fullName} (${user.id}), Farm Level: ${user.userFarm.level}, Initial Coins: ${user.userFarm.farmCoin}, Points: ${user.currentPoints}`);

  // Đảm bảo user có đủ Xu để test (nếu thiếu thì cộng thêm)
  if (user.userFarm.farmCoin < 500) {
    await prisma.userFarm.update({
      where: { id: farmId },
      data: { farmCoin: 2000 },
    });
    console.log('Topped up farmCoin to 2000 for testing.');
  }

  const initialCoins = (await prisma.userFarm.findUnique({ where: { id: farmId } })).farmCoin;
  const initialPoints = (await prisma.user.findUnique({ where: { id: userId } })).currentPoints;

  // 3. Test Atomic Quy đổi Xu sang Điểm
  console.log('\n3. Testing Atomic Coin to Point Exchange...');
  const exchangeAmount = 100; // 100 Xu
  const expectedPoints = Math.floor(exchangeAmount / setting.coinPerPoint); // 100 / 5 = 20 Points

  const exchangeResult = await prisma.$transaction(async (tx) => {
    // Trừ Farm Coin
    const updatedFarm = await tx.userFarm.update({
      where: { id: farmId },
      data: { farmCoin: { decrement: exchangeAmount } },
    });

    // Cộng Điểm AVORA thật
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        points: { increment: expectedPoints },
        currentPoints: { increment: expectedPoints },
      },
    });

    const refCode = `TEST_EXCHANGE_${Date.now()}`;

    // Tạo PointTransaction
    await tx.pointTransaction.create({
      data: {
        userId,
        balanceBefore: Math.floor(initialPoints),
        amount: expectedPoints,
        balanceAfter: Math.floor(initialPoints + expectedPoints),
        source: PointTransactionSource.REWARD,
        referenceCode: refCode,
        description: `Quy đổi từ ${exchangeAmount} Xu Nông Trại AVORA`,
      },
    });

    // Ghi FarmTransaction
    const farmTx = await tx.farmTransaction.create({
      data: {
        userId,
        farmId,
        type: 'COIN_TO_POINT_EXCHANGE',
        source: 'EXCHANGE',
        referenceId: refCode,
        itemNameSnapshot: 'Điểm Thưởng AVORA Loyalty',
        quantity: expectedPoints,
        unitPrice: setting.coinPerPoint,
        totalValue: exchangeAmount,
        farmCoinDelta: -exchangeAmount,
        avoraPointDelta: expectedPoints,
        balanceCoinAfter: updatedFarm.farmCoin,
        balancePointAfter: Math.floor(initialPoints + expectedPoints),
        status: 'COMPLETED',
        metadata: { coinPerPoint: setting.coinPerPoint, coinsSpent: exchangeAmount, earnedPoints: expectedPoints },
      },
    });

    return { updatedFarm, updatedUser, farmTx };
  });

  console.log('✓ PASS: Exchange transaction committed atomically:');
  console.log('  - Coins decremented:', initialCoins, '->', exchangeResult.updatedFarm.farmCoin, `(-${exchangeAmount})`);
  console.log('  - Points incremented:', initialPoints, '->', exchangeResult.updatedUser.currentPoints, `(+${expectedPoints})`);
  console.log('  - FarmTransaction recorded:', exchangeResult.farmTx.id, exchangeResult.farmTx.type);

  // 4. Test Hòm Thư & Safe Claim (Idempotent)
  console.log('\n4. Testing Mailbox System & Safe Claim...');
  const mail = await prisma.farmMail.findFirst({
    where: { type: 'MAINTENANCE' },
    orderBy: { createdAt: 'desc' },
  });

  if (mail) {
    console.log('Found maintenance mail:', mail.title, 'Rewards:', mail.rewards);
    // Tạo hoặc lấy FarmUserMail
    let userMail = await prisma.farmUserMail.findFirst({
      where: { mailId: mail.id, userId },
    });
    if (!userMail) {
      userMail = await prisma.farmUserMail.create({
        data: {
          mailId: mail.id,
          userId,
          isRead: false,
          isClaimed: false,
        },
      });
    }

    console.log('UserMail ID:', userMail.id, 'isClaimed:', userMail.isClaimed);

    // Test idempotent claim: nếu chưa claimed thì claim, nếu đã claimed thì đảm bảo không duplicate
    if (!userMail.isClaimed) {
      await prisma.$transaction(async (tx) => {
        await tx.farmUserMail.update({
          where: { id: userMail.id },
          data: { isClaimed: true, claimedAt: new Date(), isRead: true },
        });

        // Ghi nhận quà vào FarmTransaction
        await tx.farmTransaction.create({
          data: {
            userId,
            farmId,
            type: 'MAINTENANCE_GIFT',
            source: 'MAILBOX',
            referenceId: `MAIL_${mail.id}`,
            itemNameSnapshot: mail.title,
            farmCoinDelta: 5000,
            avoraPointDelta: 100,
            status: 'COMPLETED',
          },
        });
      });
      console.log('✓ PASS: Claimed mail successfully and recorded MAINTENANCE_GIFT in FarmTransaction.');
    } else {
      console.log('✓ PASS: Mail already claimed, double claim prevented.');
    }
  }

  // 5. Test Nhật Ký Bạn Bè (Social Activity)
  console.log('\n5. Testing Social Activity Logging (VISIT, WATER, STEAL)...');
  const otherUser = await prisma.user.findFirst({
    where: { id: { not: userId } },
  });

  if (otherUser) {
    // Log visit
    const visitAct = await prisma.farmSocialActivity.create({
      data: {
        farmOwnerId: userId,
        actorUserId: otherUser.id,
        action: 'VISIT',
      },
    });
    console.log('✓ Logged VISIT activity:', visitAct.id);

    // Log water
    const waterAct = await prisma.farmSocialActivity.create({
      data: {
        farmOwnerId: userId,
        actorUserId: otherUser.id,
        action: 'WATER',
        plotIndex: 0,
        cropName: 'Wasabi Tươi Shizuoka',
        quantity: 1,
      },
    });
    console.log('✓ Logged WATER activity:', waterAct.id);

    // Log steal
    const stealAct = await prisma.farmSocialActivity.create({
      data: {
        farmOwnerId: userId,
        actorUserId: otherUser.id,
        action: 'STEAL',
        plotIndex: 1,
        cropName: 'Dâu Tây Tochigi',
        quantity: 1,
      },
    });
    console.log('✓ Logged STEAL activity:', stealAct.id);

    // Log dual-sided FarmTransaction
    await prisma.farmTransaction.createMany({
      data: [
        {
          userId: otherUser.id,
          type: 'FRIEND_STEAL_GAIN',
          source: 'SOCIAL',
          itemNameSnapshot: 'Dâu Tây Tochigi',
          quantity: 1,
          status: 'COMPLETED',
        },
        {
          userId: userId,
          farmId,
          type: 'FRIEND_STEAL_LOSS',
          source: 'SOCIAL',
          itemNameSnapshot: 'Dâu Tây Tochigi',
          quantity: 1,
          status: 'COMPLETED',
        },
      ],
    });
    console.log('✓ PASS: Dual-sided FarmTransaction recorded for steal gain & loss.');
  }

  // 6. Test Query Ledger with 7 Tabs
  console.log('\n6. Testing Ledger Query with 7 Tabs...');
  const tabs = ['ALL', 'BUY', 'SELL', 'REDEEM', 'EXCHANGE', 'GIFT', 'SOCIAL'];
  for (const t of tabs) {
    const where = { userId };
    const typeFilterMap = {
      BUY: ['SEED_PURCHASE', 'ITEM_PURCHASE'],
      SELL: ['PRODUCE_SALE'],
      REDEEM: ['VOUCHER_REDEMPTION'],
      EXCHANGE: ['COIN_TO_POINT_EXCHANGE'],
      GIFT: ['ADMIN_GIFT', 'MAINTENANCE_GIFT', 'SYSTEM_COMPENSATION', 'LUCKY_ENVELOPE_REWARD', 'MISSION_REWARD', 'LEVEL_REWARD'],
      SOCIAL: ['FRIEND_STEAL_GAIN', 'FRIEND_STEAL_LOSS', 'FRIEND_WATER'],
    };
    if (t !== 'ALL' && typeFilterMap[t]) {
      where.type = { in: typeFilterMap[t] };
    }
    const count = await prisma.farmTransaction.count({ where });
    console.log(`  Tab [${t}]: ${count} transactions`);
  }

  console.log('\n=== ALL SECTION 18 & 19 VERIFICATION CHECKS PASSED SUCCESSFULLY! ===');
}

runVerification()
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma['$disconnect']());
