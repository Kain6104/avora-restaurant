import React from 'react';
import { notFound } from 'next/navigation';
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
  const title = product?.name || 'Chi Tiết Món Ăn';
  const description = product?.description || `Thưởng thức ${title} tươi ngon chuẩn vị Nhật Bản tại AVORA Restaurant.`;
  const image = product?.image || '/avora_logo.png';

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

  return <ItemDetailClient product={data.product} relatedDishes={data.relatedDishes} />;
}
