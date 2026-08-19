import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CategoryClient from './CategoryClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await fetch(`${API_URL}/api/categories/${resolvedParams.category}`, { 
    cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' }
  })
    .then(res => res.ok ? res.json() : null)
    .catch(() => null);

  const title = data ? `${data.name} - Avora Restaurant | Đặt Món Trực Tuyến` : 'Danh mục - Avora Restaurant';
  const description = data?.description || (data ? `Khám phá hương vị đặc trưng và đặt món ${data.name} trực tuyến ngay tại Avora Restaurant với nhiều ưu đãi hấp dẫn.` : 'Khám phá thực đơn đa dạng tại Avora Restaurant.');
  const imageUrl = data?.image || data?.imageUrl || 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=1200';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: data?.name || 'Category Image',
        }
      ],
      type: 'website',
      siteName: 'Avora Restaurant',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
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

  return <CategoryClient category={data} categorySlug={resolvedParams.category} />;
}
