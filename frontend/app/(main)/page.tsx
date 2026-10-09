import React from 'react';
import HomeClient from './HomeClient';

export default async function Home() {
  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';
  let data: any = null;

  try {
    const res = await fetch(`${apiUrl}/api/home`, { 
      cache: 'no-store',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      data = await res.json();
    }
  } catch (err) {
    // Không ném exception làm sập Server Component khi backend đang reload
    console.warn('Home data fetch fallback (backend connecting/reloading)');
  }

  return (
    <HomeClient 
      banners={Array.isArray(data?.banners) ? data.banners : []} 
      categories={Array.isArray(data?.categories) ? data.categories : []} 
      bestSellers={Array.isArray(data?.bestSellers) ? data.bestSellers : []} 
      aiRecommended={Array.isArray(data?.aiRecommended) ? data.aiRecommended : []} 
    />
  );
}