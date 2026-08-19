import React from 'react';
import HomeClient from './HomeClient';

export default async function Home() {
  const data = await fetch('http://localhost:3001/api/home', { cache: 'no-store' })
    .then((res) => res.json())
    .catch((err) => {
      console.error('Failed to fetch home data:', err);
      return { banners: [], categories: [], bestSellers: [], aiRecommended: [] };
    });

  return (
    <HomeClient 
      banners={data.banners} 
      categories={data.categories} 
      bestSellers={data.bestSellers} 
      aiRecommended={data.aiRecommended} 
    />
  );
}