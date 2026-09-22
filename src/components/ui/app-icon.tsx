import type { ReactNode } from 'react';

export type AppIconName =
  | 'home' | 'plan' | 'portfolio' | 'accounts' | 'projections' | 'settings'
  | 'search' | 'chevron-down' | 'chevron-right' | 'compass' | 'calendar'
  | 'bell' | 'trend-up' | 'wallet' | 'target' | 'percent' | 'leaf'
  | 'briefcase' | 'chart' | 'pie-chart' | 'bank' | 'cash' | 'sliders'
  | 'book' | 'link' | 'globe' | 'refresh' | 'layout' | 'sun' | 'moon'
  | 'monitor' | 'clock' | 'trophy' | 'lightbulb' | 'shield' | 'download'
  | 'trash' | 'plus' | 'check' | 'alert' | 'arrow-right' | 'receipt';

const paths: Record<AppIconName, ReactNode> = {
  home: <><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M9 20v-6h6v6" /></>,
  plan: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M16 14v6m-3-3h6" /></>,
  portfolio: <><path d="M4 8.5h16v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" /><path d="M8 8.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.5M4 13h16M10 13v2h4v-2" /></>,
  accounts: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></>,
  projections: <><path d="M5 19 19 5M10 5h9v9" /><path d="M5 8v11h11" /></>,
  settings: <path fill="currentColor" stroke="none" d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.08-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.3 7.3 0 0 0-1.69-.98L14.5 2.42A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42l-.38 2.65a7.3 7.3 0 0 0-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.05.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65a.5.5 0 0 0 .5.42h4a.5.5 0 0 0 .5-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.1-1.65ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />,
  search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></>,
  'chevron-down': <path d="m8 10 4 4 4-4" />,
  'chevron-right': <path d="m10 8 4 4-4 4" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 4-4 2 2-4z" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4m8-4v4M4 10h16" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8Z" /><path d="M10 21h4" /></>,
  'trend-up': <><path d="M4 17 10 11l4 3 6-7" /><path d="M15 7h5v5" /></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M4 9h14a2 2 0 0 1 0 4h-3" /><circle cx="15.5" cy="11" r=".6" fill="currentColor" stroke="none" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  percent: <><path d="m19 5-14 14" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  leaf: <><path d="M19.5 4.5C11 4 5.5 8.5 5.5 15.2c0 2.3 1.7 4.3 4 4.3C16 19.5 19.5 12.5 19.5 4.5Z" /><path d="M4.5 20c3-4.3 6.2-6.8 11-9" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="12" rx="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3.5 12h17M10 12v2h4v-2" /></>,
  chart: <><path d="M5 19V10m5 9V5m5 14v-7m5 7V3" /><path d="m4 16 5-5 4 2 6-7" /></>,
  'pie-chart': <><path d="M12 3v9h9" /><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.2" /></>,
  bank: <><path d="m3 10 9-6 9 6" /><path d="M5 10v8m4-8v8m4-8v8m4-8v8M3 20h18" /></>,
  cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M7 9h.01M17 15h.01" /></>,
  sliders: <><path d="M4 7h8m4 0h4M4 17h4m4 0h8" /><circle cx="14" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22Z" /><path d="M4 5.5V20M8 7h8M8 11h8" /></>,
  link: <><path d="M10 13.5a4 4 0 0 0 5.7.1l2-2a4 4 0 0 0-5.7-5.7l-1.1 1.1" /><path d="M14 10.5a4 4 0 0 0-5.7-.1l-2 2a4 4 0 0 0 5.7 5.7l1.1-1.1" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.7-3.9L4 9" /><path d="M4 4v5h5M4 13a8 8 0 0 0 14.7 3.9L20 15" /><path d="M20 20v-5h-5" /></>,
  layout: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M10 10v10" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" /></>,
  moon: <path d="M20 15.7A8.5 8.5 0 0 1 8.3 4 8.5 8.5 0 1 0 20 15.7Z" />,
  monitor: <><rect x="4" y="4" width="16" height="12" rx="2" /><path d="M8 20h8m-4-4v4" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3M12 13v4m-3 3h6" /></>,
  lightbulb: <><path d="M9 18h6M10 21h4" /><path d="M8.5 15.2A6 6 0 1 1 15.5 15.2c-.6.5-1 1.2-1 2H9.5c0-.8-.4-1.5-1-2Z" /></>,
  shield: <><path d="M12 3 19 6v5c0 4.4-3 7.6-7 10-4-2.4-7-5.6-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  download: <><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 18v2h14v-2" /></>,
  trash: <><path d="M4 7h16M10 11v5m4-5v5M9 7l1-3h4l1 3M6 7l1 13h10l1-13" /></>,
  receipt: <><path d="M5 3.5h14v17l-2-1.5-2 1.5-3-1.5-3 1.5-2-1.5-2 1.5z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><path d="M12 4 3.8 19h16.4Z" /><path d="M12 9v4m0 3h.01" /></>,
  'arrow-right': <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
};

export function AppIcon({ name, className = 'h-5 w-5', strokeWidth = 1.8 }: { name: AppIconName; className?: string; strokeWidth?: number }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name]}</svg>;
}
