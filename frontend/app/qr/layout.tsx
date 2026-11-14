import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function QrOrderingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

