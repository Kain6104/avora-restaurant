/**
 * AVORA RESTAURANT - TIỆN ÍCH DỮ LIỆU SẢN PHẨM & SỐ LƯỢNG BÁN & VIDEO REVIEW
 * Đảm bảo 100% tất cả các màn hình (Trang chủ, Thực đơn, Danh mục, Chi tiết món, Tìm kiếm)
 * luôn hiển thị ĐỒNG NHẤT một con số số lượng bán duy nhất cho mỗi món ăn.
 */

export function getProductSoldCount(product: any): number {
  if (!product) return 0;

  // 1. Nếu Database có số lượng bán thật > 0, ưu tiên tuyệt đối
  const dbSold = Number(product.soldQuantity ?? product.sold ?? 0);
  if (dbSold > 0) {
    return dbSold;
  }

  // 2. Thuật toán hash nhất quán (Deterministic Hash) theo ID / Slug / ItemCode của món
  // Đảm bảo ở bất kỳ trang nào (Menu, Category, Detail, Home, Search), cùng 1 món ăn luôn ra cùng 1 số
  const seed = String(product.id || product.slug || product.itemCode || product.name || '');
  if (!seed) return 0;

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  return (Math.abs(hash) % 240) + 45;
}

export function formatSoldCount(sold: number): string {
  if (!sold || sold <= 0) return '0';
  if (sold >= 1000) {
    return (sold / 1000).toFixed(1).replace('.0', '') + 'k';
  }
  return sold.toLocaleString('vi-VN');
}

export interface VideoEmbedInfo {
  type: 'youtube' | 'tiktok' | 'direct' | 'other' | 'none';
  embedUrl: string | null;
  videoId?: string;
  originalUrl: string;
}

export function parseVideoEmbed(url?: string | null): VideoEmbedInfo {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { type: 'none', embedUrl: null, originalUrl: '' };
  }

  const cleanUrl = url.trim();

  // 1. YouTube (youtu.be, watch?v=, embed/, shorts/)
  const ytMatch = cleanUrl.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      videoId: ytMatch[1],
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=0&rel=0&modestbranding=1`,
      originalUrl: cleanUrl,
    };
  }

  // 2. TikTok (tiktok.com/@.../video/123456789)
  const tiktokMatch = cleanUrl.match(/\/video\/(\d+)/);
  if (cleanUrl.includes('tiktok.com') && tiktokMatch && tiktokMatch[1]) {
    return {
      type: 'tiktok',
      videoId: tiktokMatch[1],
      embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`,
      originalUrl: cleanUrl,
    };
  }

  // 3. Direct video (mp4, webm, ogg, m4v)
  if (/\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(cleanUrl)) {
    return {
      type: 'direct',
      embedUrl: cleanUrl,
      originalUrl: cleanUrl,
    };
  }

  // 4. Other video URL
  return {
    type: 'other',
    embedUrl: cleanUrl,
    originalUrl: cleanUrl,
  };
}

