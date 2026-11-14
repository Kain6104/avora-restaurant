import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BranchDetailClient from './BranchDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';

async function fetchBranchData(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/home/branches/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    if (json && json.branch) {
      return {
        ...json.branch,
        menuItems: json.menuItems || [],
        vouchers: json.vouchers || [],
      };
    }
    if (json && json.success && json.data) {
      return json.data;
    }
    if (json && json.id && json.name) {
      return json;
    }
    return null;
  } catch (err) {
    console.error('Error fetching branch detail:', err);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const branch = await fetchBranchData(slug);

  if (!branch) {
    return {
      title: 'Không tìm thấy chi nhánh | AVORA Restaurant',
      description: 'Chi nhánh nhà hàng AVORA không tồn tại hoặc đã tạm dừng phục vụ.',
    };
  }

  const title = `${branch.name} - Hệ thống Nhà hàng AVORA Restaurant`;
  const address = branch.fullAddress || [branch.street, branch.ward, branch.district, branch.province].filter(Boolean).join(', ');
  const description = `Khám phá ẩm thực đỉnh cao tại ${branch.name}. Địa chỉ: ${address}. Mở cửa ${branch.openTime || '09:00'} - ${branch.closeTime || '22:00'}. Hotline: ${branch.phone || '1900 6868'}. Đặt bàn và đặt giao món trực tuyến tiện lợi.`;
  const canonicalUrl = `https://avorafnb.com/chi-nhanh/${branch.slug || slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'AVORA Restaurant',
      locale: 'vi_VN',
      type: 'website',
      images: branch.imageUrl ? [{ url: branch.imageUrl, width: 1200, height: 630, alt: branch.name }] : undefined,
    },
  };
}

export default async function BranchDetailPage({ params }: Props) {
  const { slug } = await params;
  const branch = await fetchBranchData(slug);

  if (!branch) {
    notFound();
  }

  const canonicalUrl = `https://avorafnb.com/chi-nhanh/${branch.slug || slug}`;
  const address = branch.fullAddress || [branch.street, branch.ward, branch.district, branch.province].filter(Boolean).join(', ');

  // Structured Data (JSON-LD) for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: branch.name,
    image: branch.imageUrl || 'https://avorafnb.com/avora_logo.png',
    '@id': canonicalUrl,
    url: canonicalUrl,
    telephone: branch.phone || undefined,
    priceRange: '100.000₫ - 1.500.000₫',
    servesCuisine: ['Vietnamese', 'Asian Fusion', 'Fine Dining'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: branch.street || '',
      addressLocality: branch.district || '',
      addressRegion: branch.province || 'Hồ Chí Minh',
      addressCountry: 'VN',
    },
    geo: branch.latitude && branch.longitude ? {
      '@type': 'GeoCoordinates',
      latitude: branch.latitude,
      longitude: branch.longitude,
    } : undefined,
    openingHoursSpecification: branch.openTime && branch.closeTime ? {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: branch.openTime,
      closes: branch.closeTime,
    } : undefined,
    menu: 'https://avorafnb.com/menu',
    acceptsReservations: branch.reservationEnabled ? 'True' : 'False',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BranchDetailClient branch={branch} />
    </>
  );
}
