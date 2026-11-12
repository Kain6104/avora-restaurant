import React from 'react';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import ItemDetailClient from './ItemDetailClient';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';

export async function generateMetadata({ params }: { params: Promise<{ category: string, slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await fetch(`${API_URL}/api/products/${resolvedParams.category}/${resolvedParams.slug}`, { 
    cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' }
  })
    .then(res => res.ok ? res.json() : null)
    .catch(() => null);

  const product = data?.product;
  const title = product?.name ? `${product.name} - Nhà hàng AVORA` : 'Chi tiết món ăn - AVORA Restaurant';
  const rawDesc = product?.description ? product.description.replace(/<[^>]*>/g, '').trim() : '';
  const description = rawDesc || `Thưởng thức ${title} tươi ngon chuẩn vị Nhật Bản tại AVORA Restaurant.`;
  const image = product?.imageUrl || product?.image || '/avora_logo.png';

  return {
    title,
    description,
    openGraph: {
      title: `${title} | AVORA Restaurant`,
      description,
      images: [{ url: image }],
    },
  };
}

export default async function ItemDetailPage({ params }: { params: Promise<{ category: string, slug: string }> }) {
  const resolvedParams = await params;
  if (resolvedParams.slug === 'ai-meal-architect' || resolvedParams.slug.includes('meal-architect')) {
    notFound();
  }

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

  if (data.product.id === 'prod-ai-meal-architect' || data.product.slug === 'ai-meal-architect') {
    notFound();
  }

  // Canonical redirect for legacy URLs (e.g. /nuoc-ep-trai-cay-3031/san-pham-100-8r7hbq -> /do-uong-trang-mieng/nuoc-ep-tuoi-dua-hau)
  const canonicalCatSlug = data.product.category?.slug || resolvedParams.category;
  const canonicalProdSlug = data.product.slug;

  if (canonicalCatSlug && canonicalProdSlug) {
    if (resolvedParams.category !== canonicalCatSlug || resolvedParams.slug !== canonicalProdSlug) {
      redirect(`/${canonicalCatSlug}/${canonicalProdSlug}`);
    }
  }

  return (
    <ItemDetailClient 
      product={data.product} 
      relatedDishes={data.relatedDishes || []} 
      relatedArticles={data.relatedArticles || []} 
    />
  );
}
