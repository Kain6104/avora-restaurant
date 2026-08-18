import React from 'react';
import Link from 'next/link';
import { ChevronRight, Star, Heart } from 'lucide-react';
import { notFound } from 'next/navigation';
import AddToCartForm from '../../../../components/AddToCartForm';
import type { Metadata } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function generateMetadata({ params }: { params: Promise<{ category: string, slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await fetch(`${API_URL}/api/products/${resolvedParams.category}/${resolvedParams.slug}`, { 
    cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' }
  })
    .then(res => res.ok ? res.json() : null)
    .catch(() => null);

  return {
    title: data?.product?.name || 'Chi tiết món ăn',
  };
}

export default async function ItemDetailPage({ params }: { params: Promise<{ category: string, slug: string }> }) {
  const resolvedParams = await params;
  const data = await fetch(`${API_URL}/api/products/${resolvedParams.category}/${resolvedParams.slug}`, { 
    cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' }
  })
    .then(res => {
      if (!res.ok) return null;
      return res.json();
    })
    .catch(() => null);

  if (!data || !data.product) {
    notFound();
  }

  const { product, relatedDishes } = data;
  const { category, optionGroups } = product;

  return (
    <div className="bg-slate-50 min-h-screen pb-20 flex flex-col">
      
      {/* Breadcrumb */}
      <div className="sticky top-[52px] md:top-[68px] z-[45] bg-white border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center gap-2 text-sm text-slate-500 overflow-x-auto whitespace-nowrap hide-scrollbar">
          <Link href="/" className="hover:text-red-600">Trang chủ</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <Link href={`/${category.slug}`} className="hover:text-red-600">{category.name}</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <span className="text-slate-900 font-medium">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 flex flex-col">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col lg:flex-row flex-1">
          
          {/* Image Gallery */}
          <div className="w-full lg:w-5/12 bg-slate-100 relative p-8 flex items-center justify-center min-h-[300px] lg:min-h-full shrink-0">
            {product.badge && (
              <span className={`absolute top-6 left-6 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg z-10`}>
                {product.badge}
              </span>
            )}
            <button className="absolute top-6 right-6 w-10 h-10 bg-white rounded-full shadow flex items-center justify-center text-slate-400 hover:text-red-500 hover:scale-110 transition-all z-10">
              <Heart className="w-5 h-5" />
            </button>
            <img src={product.imageUrl} alt={product.name} className="w-full h-full max-w-[400px] max-h-[400px] object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500" />
          </div>

          {/* Product Details & Options */}
          <div className="w-full lg:w-7/12 p-6 md:p-10 flex flex-col h-full lg:max-h-[700px]">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full">{category.name}</span>
              <div className="flex items-center text-yellow-400 text-sm font-bold">
                <Star className="w-4 h-4 fill-current" />
                <span className="ml-1 text-slate-700">4.9 (128)</span>
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2 leading-tight">{product.name}</h1>
            <p className="text-slate-500 text-lg mb-4 line-clamp-2">{product.description}</p>
            
            <AddToCartForm basePrice={product.price} optionGroups={optionGroups} />
          </div>
        </div>

        {/* Related Dishes */}
        {relatedDishes && relatedDishes.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-black text-slate-900 uppercase mb-8">Có thể bạn sẽ thích</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {relatedDishes.map((item: any) => (
                <Link key={item.id} href={`/${category.slug}/${item.slug}`} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-slate-100 group flex flex-col">
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-slate-800 text-base mb-1 group-hover:text-red-600 transition-colors line-clamp-2">{item.name}</h3>
                    <p className="text-red-600 font-bold text-base mt-auto">{item.price.toLocaleString('vi-VN')}đ</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
