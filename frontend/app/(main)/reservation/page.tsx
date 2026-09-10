'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BookingPage from '../booking/page';

export default function ReservationRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/booking');
  }, [router]);

  return <BookingPage />;
}
