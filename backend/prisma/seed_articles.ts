import { PrismaClient, ArticleType, ArticleStatus, ArticleVisibility, ReactionType, CommentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding AVORA Restaurant Articles...');

  // 1. Get Admin User
  let admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!admin) {
    admin = await prisma.user.findFirst();
  }

  if (!admin) {
    console.error('No users found in database to assign as author.');
    return;
  }

  // 2. Get Products, Vouchers, Branches, Tiers
  const products = await prisma.product.findMany({ take: 6 });
  const vouchers = await prisma.voucher.findMany({ take: 2 });
  const branches = await prisma.branch.findMany({ take: 3 });
  const tiers = await prisma.membershipTier.findMany({ take: 3 });

  const now = new Date();
  const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const futureStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const futureEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const ongoingStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const ongoingEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const endedStart = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
  const endedEnd = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  // Article 1: ONGOING PROMOTION
  const art1 = await prisma.article.upsert({
    where: { slug: 'dai-tiec-sushi-sashimi-uu-dai-20-phan-tram' },
    update: {},
    create: {
      title: 'Đại Tiệc Buffet Sushi & Sashimi Cao Cấp: Ưu Đãi 20% Toàn Hệ Thống',
      slug: 'dai-tiec-sushi-sashimi-uu-dai-20-phan-tram',
      excerpt: 'Thưởng thức hơn 50+ món Sushi và Sashimi cá hồi Na Uy tươi sống thượng hạng với mức giá ưu đãi cực sốc dành riêng cho tháng này.',
      content: `
<h2>Hương vị tinh hoa ẩm thực xứ Phù Tang</h2>
<p>Chào đón mùa lễ hội ẩm thực cùng <strong>AVORA Restaurant</strong> với chương trình tri ân khách hàng lớn nhất năm. Thực khách sẽ được đắm chìm trong không gian ẩm thực Nhật Bản đương đại, thưởng thức từng lát Sashimi cá hồi béo ngậy, cá ngừ đại dương tươi rói và các loại Nigiri được chế biến cầu kỳ bởi bàn tay của Bếp Trưởng với hơn 15 năm kinh nghiệm.</p>

<h3>Chi tiết chương trình ưu đãi</h3>
<ul>
  <li>Giảm trực tiếp <strong>20% trên tổng hóa đơn</strong> cho bàn từ 2 khách trở lên.</li>
  <li>Tặng kèm 01 phần <em>Nigiri Bò Wagyu A5 dát vàng</em> cho hóa đơn từ 1.000.000đ.</li>
  <li>Áp dụng đồng thời với tích lũy điểm thưởng thành viên AVORA Rewards.</li>
</ul>

<p>Đừng bỏ lỡ cơ hội thưởng thức tinh hoa ẩm thực Nhật Bản với mức giá tuyệt vời nhất. Đặt bàn ngay hôm nay để nhận vị trí đẹp nhất!</p>
`,
      thumbnailUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600',
      coverImageUrl: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=1200',
      authorId: admin.id,
      articleType: ArticleType.PROMOTION,
      status: ArticleStatus.PUBLISHED,
      visibility: ArticleVisibility.PUBLIC,
      publishedAt: pastDate,
      promotionStartAt: ongoingStart,
      promotionEndAt: ongoingEnd,
      promotionLabel: 'HOT DEAL - GIẢM 20%',
      promotionTerms: 'Áp dụng cho khách hàng dùng bữa tại nhà hàng và đặt giao hàng online. Không áp dụng đồng thời với một số combo đặc biệt.',
      isFeatured: true,
      viewCount: 1420,
      shareCount: 88,
      seoTitle: 'Đại Tiệc Buffet Sushi & Sashimi Giảm 20% - AVORA Restaurant',
      seoDescription: 'Thưởng thức hơn 50+ món Sushi và Sashimi cá hồi tươi sống với ưu đãi 20% tại AVORA Restaurant.',
      products: products.length > 0 ? {
        create: products.slice(0, 3).map((p, idx) => ({
          productId: p.id,
          displayOrder: idx,
        })),
      } : undefined,
      vouchers: vouchers.length > 0 ? {
        create: [{ voucherId: vouchers[0].id }],
      } : undefined,
      branches: branches.length > 0 ? {
        connect: branches.map((b) => ({ id: b.id })),
      } : undefined,
    },
  });

  // Article 2: BRAND STORY
  const art2 = await prisma.article.upsert({
    where: { slug: 'nghe-thuat-am-thuc-omakase-tai-avora' },
    update: {},
    create: {
      title: 'Nghệ Thuật Omakase: Khi Mỗi Món Ăn Là Một Bản Giao Hưởng Cảm Xúc',
      slug: 'nghe-thuat-am-thuc-omakase-tai-avora',
      excerpt: 'Khám phá hành trình sáng tạo đằng sau triết lý Omakase - nơi thực khách gửi trọn niềm tin vào sự sáng tạo của Bếp Trưởng.',
      content: `
<h2>Omakase - Lời gửi gắm trọn vẹn của thực khách</h2>
<p>Trong tiếng Nhật, <em>"Omakase" (お任せ)</em> có nghĩa là "Hãy để tôi quyết định". Đây không đơn thuần là một bữa ăn, mà là một trải nghiệm nghệ thuật vị giác độc bản, nơi Bếp Trưởng sẽ dựa vào nguồn nguyên liệu tươi ngon nhất được tuyển chọn trong ngày để thiết kế một thực đơn hoàn toàn riêng biệt.</p>

<h3>Tiêu chuẩn khắt khe về nguyên liệu tại AVORA</h3>
<p>Tại AVORA, 100% cá hồi được nhập khẩu trực tiếp bằng đường hàng không từ vịnh Na Uy mỗi sáng sớm. Các loại hải sản cao cấp như Cầu gai Uni Hokkaido, Sò điệp Hotate và Bò Wagyu A5 đều trải qua quy trình kiểm soát nhiệt độ nghiêm ngặt chuẩn Nhật.</p>

<p>Mỗi miếng cơm Shari được căn chỉnh độ ấm ở 36.5°C - tương đương nhiệt độ cơ thể người, kết hợp với giấm đỏ lên men truyền thống để tôn vinh trọn vẹn vị ngọt thanh của hải sản.</p>
`,
      thumbnailUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600',
      coverImageUrl: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=1200',
      authorId: admin.id,
      articleType: ArticleType.BRAND_STORY,
      status: ArticleStatus.PUBLISHED,
      visibility: ArticleVisibility.PUBLIC,
      publishedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      isFeatured: true,
      viewCount: 2350,
      shareCount: 145,
      seoTitle: 'Nghệ Thuật Omakase Thượng Hạng - AVORA Restaurant',
      seoDescription: 'Khám phá triết lý Omakase đỉnh cao và nguyên liệu tươi ngon chuẩn Nhật tại AVORA Restaurant.',
      products: products.length > 3 ? {
        create: products.slice(2, 5).map((p, idx) => ({
          productId: p.id,
          displayOrder: idx,
        })),
      } : undefined,
    },
  });

  // Article 3: UPCOMING PROMOTION (MEMBERS ONLY)
  const art3 = await prisma.article.upsert({
    where: { slug: 'dac-quyen-thanh-vien-vip-tang-set-sashimi' },
    update: {},
    create: {
      title: 'Đặc Quyền Hội Viên Vàng & Bạch Kim: Tặng Set Sashimi Thượng Hạng',
      slug: 'dac-quyen-thanh-vien-vip-tang-set-sashimi',
      excerpt: 'Chương trình tri ân hội viên thân thiết VIP với quà tặng độc quyền Set Sashimi 5 Món dành cho thành viên Gold và Platinum.',
      content: `
<h2>Món quà tri ân dành riêng cho hội viên tinh hoa</h2>
<p>AVORA Restaurant trân trọng gửi lời cảm ơn sâu sắc đến quý khách hàng thân thiết đã đồng hành cùng nhà hàng trong suốt chặng đường vừa qua. Chương trình <strong>VIP Exclusive Gift</strong> sắp chính thức khởi động!</p>

<h3>Quyền lợi hội viên nhận được</h3>
<ul>
  <li><strong>Hạng Gold (Vàng):</strong> Tặng 01 Set Sashimi Cá Hồi & Sò Điệp Nhật trị giá 350.000đ khi dùng bữa từ 800.000đ.</li>
  <li><strong>Hạng Platinum (Bạch Kim):</strong> Tặng 01 Set Sashimi Thượng Hạng 5 Món kèm 01 bình Sake thượng hạng trị giá 650.000đ.</li>
  <li>Nhân đôi điểm tích lũy trong tuần lễ tri ân.</li>
</ul>
`,
      thumbnailUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600',
      coverImageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200',
      authorId: admin.id,
      articleType: ArticleType.PROMOTION,
      status: ArticleStatus.PUBLISHED,
      visibility: ArticleVisibility.MEMBERS_ONLY,
      publishedAt: pastDate,
      promotionStartAt: futureStart,
      promotionEndAt: futureEnd,
      promotionLabel: 'SẮP DIỄN RA - ĐẶC QUYỀN VIP',
      promotionTerms: 'Chỉ áp dụng cho tài khoản đạt hạng Gold hoặc Platinum tại thời điểm sử dụng.',
      isFeatured: false,
      viewCount: 890,
      shareCount: 32,
      seoTitle: 'Đặc Quyền Thành Viên VIP - AVORA Restaurant',
      seoDescription: 'Quà tặng độc quyền Set Sashimi dành riêng cho hội viên Gold & Platinum tại AVORA.',
      membershipTiers: tiers.length > 0 ? {
        connect: tiers.slice(0, 2).map((t) => ({ id: t.id })),
      } : undefined,
    },
  });

  // Article 4: GUIDE
  const art4 = await prisma.article.upsert({
    where: { slug: 'huong-dan-thuong-thuc-ruou-sake-dung-chuan' },
    update: {},
    create: {
      title: 'Bí Quyết Thưởng Thức Rượu Sake Chuẩn Phong Vị Nhật Bản',
      slug: 'huong-dan-thuong-thuc-ruou-sake-dung-chuan',
      excerpt: 'Cẩm nang từ chuyên gia Sommelier của AVORA giúp bạn chọn đúng dòng Sake để nâng tầm hương vị từng món ăn.',
      content: `
<h2>Văn hóa Sake và sự kết hợp món ăn hoàn hảo</h2>
<p>Rượu Sake (Nihonshu) không đơn thuần là đồ uống, mà là linh hồn của bữa tiệc Nhật Bản. Việc lựa chọn nhiệt độ và dòng rượu phù hợp sẽ giúp vị béo ngậy của Sashimi và độ đậm đà của Teriyaki bùng nổ hương vị.</p>

<h3>Các nguyên tắc thưởng thức cốt lõi:</h3>
<ol>
  <li><strong>Junmai Daiginjo:</strong> Dòng rượu tinh khiết nhất, thưởng thức ướp lạnh ở 10-12°C, hoàn hảo khi đi kèm Sashimi cá trắng hoặc Sò điệp.</li>
  <li><strong>Honjozo:</strong> Hương thơm thanh mát, thích hợp thưởng thức ở nhiệt độ phòng cùng các món nướng Yakitori và Tempura.</li>
</ol>
`,
      thumbnailUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600',
      coverImageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
      authorId: admin.id,
      articleType: ArticleType.GUIDE,
      status: ArticleStatus.PUBLISHED,
      visibility: ArticleVisibility.PUBLIC,
      publishedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      isFeatured: false,
      viewCount: 1680,
      shareCount: 74,
      seoTitle: 'Hướng Dẫn Thưởng Thức Rượu Sake - AVORA Restaurant',
      seoDescription: 'Cẩm nang chọn và thưởng thức rượu Sake chuẩn phong vị Nhật Bản tại AVORA.',
    },
  });

  // Seed sample Reactions and Comments on Article 1
  try {
    await prisma.articleReaction.createMany({
      data: [
        { articleId: art1.id, userId: admin.id, type: ReactionType.LOVE },
      ],
      skipDuplicates: true,
    });

    await prisma.articleComment.create({
      data: {
        articleId: art1.id,
        userId: admin.id,
        content: 'Chương trình ưu đãi cực kỳ hấp dẫn! Món cá hồi Na Uy tại AVORA luôn tươi ngon số 1.',
        status: CommentStatus.ACTIVE,
      },
    });
  } catch (e) {
    // Silent duplicate ignore
  }

  console.log('Seeded 4 articles successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
