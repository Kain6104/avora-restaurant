export const SLIDES = [
  {
    id: 1,
    subtitle: "TINH HOA ẨM THỰC NHẬT BẢN",
    title: "TRẢI NGHIỆM VỊ NGON",
    titleHighlight: "CHUẨN NHẬT",
    desc: "Avora mang đến cho bạn những món ăn chuẩn vị Nhật với nguyên liệu tươi ngon nhất.",
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=1920",
    badge: { text: "Ưu đãi đến", highlight: "-30%", sub: "HÔM NAY" }
  },
  {
    id: 2,
    subtitle: "TƯƠI RÓI MỖI NGÀY",
    title: "THƯỞNG THỨC SASHIMI",
    titleHighlight: "THƯỢNG HẠNG",
    desc: "Cảm nhận hương vị biển cả thuần khiết qua từng lát cắt điệu nghệ của đầu bếp Avora.",
    image: "https://images.unsplash.com/photo-1583623025817-d180a2221d0a?auto=format&fit=crop&q=80&w=1920",
    badge: { text: "Tặng kèm", highlight: "Rượu Sake", sub: "Cho bàn 4 người" }
  },
  {
    id: 3,
    subtitle: "NƯỚNG THAN HOA",
    title: "WAGYU A5 TAN CHẢY",
    titleHighlight: "TRÊN TỪNG THỚ THỊT",
    desc: "Thịt bò Wagyu nhập khẩu trực tiếp, mang đến trải nghiệm ẩm thực không thể nào quên.",
    image: "https://images.unsplash.com/photo-1544025162-8111149f57b7?auto=format&fit=crop&q=80&w=1920",
    badge: { text: "Giảm giá", highlight: "10%", sub: "Thành viên VIP" }
  }
];

export const CATEGORIES = [
  { id: 'sushi', name: 'Sushi', slug: 'sushi', image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&q=80&w=150' },
  { id: 'sashimi', name: 'Sashimi', slug: 'sashimi', image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&q=80&w=150' },
  { id: 'maki', name: 'Maki', slug: 'maki', image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&q=80&w=150' },
  { id: 'donburi', name: 'Donburi', slug: 'donburi', image: 'https://images.unsplash.com/photo-1581781870027-04212e231e96?auto=format&fit=crop&q=80&w=150' },
  { id: 'ramen', name: 'Ramen', slug: 'ramen', image: 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&q=80&w=150' },
  { id: 'tempura', name: 'Tempura', slug: 'tempura', image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=150' },
  { id: 'salad', name: 'Salad', slug: 'salad', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=150' },
  { id: 'dessert', name: 'Tráng miệng', slug: 'trang-mieng', image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&q=80&w=150' },
];

export const ALL_DISHES = [
  { id: 1, categoryId: 'sushi', slug: 'combo-sushi-avora', name: 'Combo Sushi Avora', desc: '20 miếng', price: '399.000đ', oldPrice: null, badge: 'BEST', badgeColor: 'bg-red-600', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=500' },
  { id: 2, categoryId: 'sashimi', slug: 'sashimi-tong-hop', name: 'Sashimi Tổng Hợp', desc: '15 lát', price: '259.000đ', oldPrice: '320.000đ', badge: '-20%', badgeColor: 'bg-red-600', image: 'https://images.unsplash.com/photo-1583623025817-d180a2221d0a?auto=format&fit=crop&q=80&w=500' },
  { id: 3, categoryId: 'maki', slug: 'maki-ca-hoi-bo', name: 'Maki Cá Hồi Bơ', desc: '8 miếng', price: '129.000đ', oldPrice: null, badge: null, image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&q=80&w=500' },
  { id: 4, categoryId: 'donburi', slug: 'com-ca-hoi-nhat', name: 'Cơm Cá Hồi Nhật', desc: '1 phần', price: '159.000đ', oldPrice: null, badge: null, image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&q=80&w=500' },
  { id: 5, categoryId: 'ramen', slug: 'ramen-bo-my', name: 'Ramen Bò Mỹ', desc: '1 phần', price: '149.000đ', oldPrice: null, badge: 'HOT', badgeColor: 'bg-orange-500', image: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&q=80&w=500' },
  { id: 6, categoryId: 'tempura', slug: 'tempura-tong-hop', name: 'Tempura Tổng Hợp', desc: '1 phần', price: '139.000đ', oldPrice: null, badge: null, image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=500' },
  { id: 7, categoryId: 'salad', slug: 'salad-rong-bien', name: 'Salad Rong Biển', desc: '1 phần', price: '89.000đ', oldPrice: null, badge: 'NEW', badgeColor: 'bg-green-500', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=500' },
  { id: 8, categoryId: 'sashimi', slug: 'sashimi-ca-hoi', name: 'Sashimi Cá Hồi', desc: '5 lát', price: '129.000đ', oldPrice: null, badge: null, image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&q=80&w=500' },
  { id: 9, categoryId: 'dessert', slug: 'mochi-tra-xanh', name: 'Mochi Trà Xanh', desc: '3 cái', price: '59.000đ', oldPrice: null, badge: null, image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&q=80&w=500' },
];

export const BEST_SELLERS = ALL_DISHES.filter(d => [1, 2, 3, 4, 5, 6].includes(d.id));
