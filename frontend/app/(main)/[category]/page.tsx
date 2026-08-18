import React from 'react';
import Link from 'next/link';
import { Plus, ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await fetch(`${API_URL}/api/categories/${resolvedParams.category}`, { 
    cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' }
  })
    .then(res => res.ok ? res.json() : null)
    .catch(() => null);

  return {
    title: data?.name || 'Danh mục',
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const resolvedParams = await params;
  const data = await fetch(`${API_URL}/api/categories/${resolvedParams.category}`, { 
    cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' }
  })
    .then(res => {
      if (!res.ok) return null;
      return res.json();
    })
    .catch(() => null);

  if (!data) {
    notFound();
  }

  const { name, image, products } = data;

  return (
    <div className="bg-slate-50 min-h-screen pb-20">

      {/* Breadcrumb */}
      <div className="sticky top-[52px] md:top-[68px] z-[45] bg-white border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-red-600">Trang chủ</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-900 font-medium">{name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="w-20 h-20 rounded-full bg-slate-50 p-1 border border-slate-100 shrink-0">
            <img src={image || 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400'} alt={name} className="w-full h-full object-cover rounded-full" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-1">{name}</h1>
            <p className="text-slate-500">Khám phá hương vị đặc trưng của {name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products?.map((item: any) => (
            <Link key={item.id} href={`/${resolvedParams.category}/${item.slug}`} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-slate-100 group flex flex-col">
              <div className="relative aspect-square overflow-hidden bg-slate-100">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                {item.badge && (
                  <span className={`absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-md`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-slate-800 text-base md:text-lg mb-1 group-hover:text-red-600 transition-colors line-clamp-1">{item.name}</h3>
                <p className="text-slate-500 text-xs md:text-sm mb-4 line-clamp-1">{item.description}</p>
                <div className="mt-auto flex items-center justify-between">
                  <div>
                    <p className="text-red-600 font-bold text-base">{item.price.toLocaleString('vi-VN')}đ</p>
                    {item.oldPrice && <p className="text-slate-400 text-xs line-through">{item.oldPrice.toLocaleString('vi-VN')}đ</p>}
                  </div>
                  <button className="w-8 h-8 bg-slate-100 hover:bg-red-600 hover:text-white text-slate-600 rounded-full flex items-center justify-center transition-colors shrink-0">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {(!products || products.length === 0) && (
          <div className="text-center py-20">
            <img src="https://illustrations.popsy.co/amber/falling.svg" className="w-48 h-48 mx-auto mb-4 opacity-50" alt="Empty" />
            <p className="text-slate-500 font-medium">Món ăn đang được cập nhật...</p>
          </div>
        )}
      </div>
    </div>
  );
}
