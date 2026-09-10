'use client';

import React from 'react';
import { ShoppingBag, Plus, Tag, Utensils } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import toast from 'react-hot-toast';

export interface ArticleProductItem {
  id: string;
  articleId: string;
  productId: string;
  displayOrder: number;
  highlightNote?: string | null;
  product: {
    id: string;
    name: string;
    slug?: string;
    price: number;
    originalPrice?: number | null;
    image?: string | null;
    imageUrl?: string | null;
    description?: string | null;
    isAvailable?: boolean;
    category?: {
      name: string;
    } | null;
  };
}

interface RelatedProductsProps {
  articleId: string;
  products: ArticleProductItem[];
}

export default function RelatedProducts({ articleId, products }: RelatedProductsProps) {
  const { addToCart, currentBranchId } = useCart();

  if (!products || products.length === 0) return null;

  const handleProductClick = (productId: string) => {
    // Record PRODUCT_CLICK analytics event for CTR calculation
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      fetch(`${baseUrl}/api/articles/${articleId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventType: 'PRODUCT_CLICK',
          metadata: { productId },
        }),
      }).catch(() => {});
    } catch {
      // Non-blocking analytics
    }
  };

  const handleAddToCart = (e: React.MouseEvent, item: ArticleProductItem) => {
    e.stopPropagation();
    handleProductClick(item.product.id);

    addToCart(
      {
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        image: item.product.image || item.product.imageUrl || '',
        quantity: 1,
      } as any,
      currentBranchId || ''
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="my-8 p-4 sm:p-6 bg-gradient-to-br from-amber-50/60 via-red-50/40 to-orange-50/60 rounded-3xl border border-red-100/80 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm">
            <Utensils size={16} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Món ngon trong bài viết
            </h3>
            <p className="text-xs text-slate-500">Thưởng thức ngay hương vị đặc sắc của AVORA</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-red-100/80 text-red-700 rounded-full">
          {products.length} món
        </span>
      </div>

      {/* Product Cards: Mobile Horizontal Swipe Scroll, Desktop Grid */}
      <div className="flex overflow-x-auto sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-2 sm:pb-0 custom-scrollbar snap-x snap-mandatory sm:overflow-visible">
        {products.map(({ product, highlightNote }) => {
          const imgUrl =
            product.image ||
            product.imageUrl ||
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';
          const hasDiscount = product.originalPrice && product.originalPrice > product.price;

          return (
            <div
              key={product.id}
              onClick={() => handleProductClick(product.id)}
              className="group bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-red-200 transition-all duration-200 flex flex-col justify-between min-w-[210px] max-w-[240px] sm:min-w-0 sm:max-w-none snap-start shrink-0 sm:shrink"
            >
              <div>
                {/* Image + Discount Badge */}
                <div className="relative aspect-4/3 rounded-xl overflow-hidden mb-2.5 bg-slate-100">
                  <img
                    src={imgUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {hasDiscount && (
                    <div className="absolute top-2 left-2 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase shadow-xs flex items-center gap-0.5">
                      <Tag size={10} /> Giảm giá
                    </div>
                  )}
                  {highlightNote && (
                    <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-lg truncate">
                      {highlightNote}
                    </div>
                  )}
                </div>

                {/* Info */}
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 group-hover:text-red-600 transition-colors">
                  {product.name}
                </h4>
                {product.description && (
                  <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 mt-0.5">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Price & Add to Cart */}
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
                <div>
                  <span className="font-extrabold text-xs sm:text-sm text-red-600">
                    {formatCurrency(product.price)}
                  </span>
                  {hasDiscount && product.originalPrice && (
                    <span className="block text-[10px] text-slate-400 line-through">
                      {formatCurrency(product.originalPrice)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => handleAddToCart(e, { product, highlightNote } as any)}
                  className="p-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl transition-all duration-150 shadow-2xs hover:shadow-sm cursor-pointer active:scale-95"
                  title="Thêm vào giỏ"
                >
                  <Plus size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
