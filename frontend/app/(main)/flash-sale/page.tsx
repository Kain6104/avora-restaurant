import type { Metadata } from 'next';
import FlashSaleClient from './FlashSaleClient';

export const metadata: Metadata = {
  title: 'Flash Sale Giờ Vàng - Ưu Đãi Cực Sốc | Avora Restaurant',
  description: 'Săn deal ẩm thực Nhật Bản & Á Âu cực sốc tại Avora Restaurant. Giảm đến 50% các món Sushi, Sashimi, Nướng Wagyu trong khung giờ vàng!',
  openGraph: {
    title: 'Flash Sale Giờ Vàng - Ưu Đãi Cực Sốc | Avora Restaurant',
    description: 'Ưu đãi ẩm thực đỉnh cao có hạn. Đặt ngay các món Flash Sale hôm nay để nhận giá tốt nhất!',
    type: 'website',
  },
};

export default function FlashSalePage() {
  return <FlashSaleClient />;
}
