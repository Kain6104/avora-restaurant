import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import ArticleDetailClient, { ArticleDetailData } from './ArticleDetailClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getArticle(slug: string): Promise<ArticleDetailData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['Cookie'] = `token=${token}`;
    }

    const res = await fetch(`${baseUrl}/api/articles/${slug}`, {
      cache: 'no-store',
      headers,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      if (errJson?.data) return errJson.data;
      return null;
    }

    const json = await res.json();
    const data = json?.data || json;
    if (!data || (!data.id && !data.slug)) return null;
    return data;
  } catch (err) {
    console.error('Error fetching article detail:', err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return {
      title: 'Không tìm thấy bài viết | AVORA Restaurant',
    };
  }

  const isProtected = article.visibility === 'MEMBERS_ONLY' || article.visibility === 'PRIVATE';

  return {
    title: `${article.title} | AVORA Restaurant`,
    description: article.excerpt || `Đọc bài viết ${article.title} tại AVORA Restaurant`,
    robots: isProtected
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: `${article.title} | AVORA Restaurant`,
      description: article.excerpt || `Đọc bài viết ${article.title} tại AVORA Restaurant`,
      images: article.coverImage ? [article.coverImage] : ['/avora_logo.png'],
      type: 'article',
      publishedTime: article.publishedAt || undefined,
    },
  };
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  return <ArticleDetailClient article={article} />;
}
