import React from 'react';
import { Metadata } from 'next';
import NewsListClient from './NewsListClient';

export const metadata: Metadata = {
  title: 'Tin Tức & Ưu Đãi Ẩm Thực | AVORA Restaurant',
  description: 'Khám phá các chương trình khuyến mãi độc quyền, thực đơn mới, câu chuyện thương hiệu và cẩm nang ẩm thực tại AVORA Restaurant.',
  openGraph: {
    title: 'Tin Tức & Ưu Đãi Ẩm Thực | AVORA Restaurant',
    description: 'Khám phá các chương trình khuyến mãi độc quyền, thực đơn mới, câu chuyện thương hiệu và cẩm nang ẩm thực tại AVORA Restaurant.',
  },
};

async function getArticles() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${baseUrl}/api/articles?limit=50`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    const list = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.data?.articles)
      ? json.data.articles
      : Array.isArray(json.articles)
      ? json.articles
      : [];
    return list;
  } catch (err) {
    console.error('Error fetching articles on server:', err);
    return [];
  }
}

export default async function NewsPage() {
  const initialArticles = await getArticles();
  return <NewsListClient initialArticles={initialArticles} />;
}
