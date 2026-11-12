'use client';

import React from 'react';
import { useWaiterStore } from '@/store/useWaiterStore';
import PersonalTimecardView from './PersonalTimecardView';

export default function AttendanceView() {
  const { setActiveTab } = useWaiterStore();

  return <PersonalTimecardView onBack={() => setActiveTab('TABLES')} />;
}

