'use client';

import { useEffect, useState } from 'react';

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardGreeting({ firstName, savingsCopy }: { firstName: string; savingsCopy: string }) {
  const [greeting, setGreeting] = useState('Good morning');
  useEffect(() => setGreeting(greetingForHour(new Date().getHours())), []);
  return <><h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[2.55rem]">{greeting}, {firstName}.</h1><p className="mt-2 text-sm font-medium text-[var(--text-body)] sm:text-base">{savingsCopy}</p></>;
}
