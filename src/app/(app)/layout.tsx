import { authGuard } from '@/lib/supabase/middleware';
import { DisplayPreferences } from '@/components/display-preferences';
import { Nav } from '@/components/nav';
import { serverSupabase } from '@/lib/supabase/server';
import { getAccountAllocations, getHoldings } from '@/lib/db/queries';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Any signed-out visitor hitting an app route is redirected to /login.
  const user = await authGuard();
  const profileName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Your profile').toString();
  const supabase = await serverSupabase();
  const [accountAllocations, holdings] = await Promise.all([
    getAccountAllocations(supabase, user.id),
    getHoldings(supabase, user.id),
  ]);
  const pageItems = [
    { id: 'action-baseline', group: 'Actions' as const, title: 'Edit financial baseline', detail: 'Income, expenses and emergency fund', href: '/plan#financial-baseline', icon: 'plan' },
    { id: 'action-purchases', group: 'Actions' as const, title: 'Planned purchases', detail: 'Investment allocations within TFSA and RRSP', href: '/plan#planned-purchases', icon: 'portfolio' },
    { id: 'page-rules', group: 'Pages' as const, title: 'Strategy reference', detail: 'Planning guidelines', href: '/rules', icon: 'plan' },
    { id: 'page-fx', group: 'Pages' as const, title: 'Foreign exchange', detail: 'Currency conversion calculator', href: '/fx', icon: 'accounts' },
    { id: 'page-dashboard', group: 'Pages' as const, title: 'Dashboard', detail: 'Your financial overview', href: '/dashboard', icon: 'home' },
    { id: 'page-plan', group: 'Pages' as const, title: 'Plan', detail: 'Monthly allocations and contribution plan', href: '/plan', icon: 'plan' },
    { id: 'page-portfolio', group: 'Pages' as const, title: 'Portfolio', detail: 'Holdings, performance, and allocation', href: '/portfolio', icon: 'portfolio' },
    { id: 'page-accounts', group: 'Pages' as const, title: 'Accounts', detail: 'Contribution room and account balances', href: '/accounts', icon: 'accounts' },
    { id: 'page-projections', group: 'Pages' as const, title: 'Projections', detail: 'Long-term portfolio growth', href: '/projections', icon: 'projections' },
    { id: 'page-settings', group: 'Pages' as const, title: 'Settings', detail: 'Preferences and application settings', href: '/settings', icon: 'settings' },
  ];
  const searchItems = [
    ...pageItems,
    ...accountAllocations.map((allocation) => ({ id: `account-${allocation.account}`, group: 'Accounts' as const, title: allocation.account, detail: 'View account balance and contribution room', href: '/accounts', icon: 'accounts' })),
    ...holdings.map((holding) => ({ id: `holding-${holding.id}`, group: 'Holdings' as const, title: holding.ticker ?? 'Holding', detail: `${holding.name ?? 'Investment'} · ${holding.account}`, href: '/portfolio', icon: 'portfolio' })),
    { id: 'action-contribution', group: 'Actions' as const, title: 'Record a contribution', detail: 'Open account contributions', href: '/accounts/manage#record-contribution', icon: 'plan' },
    { id: 'action-plan', group: 'Actions' as const, title: 'Edit monthly plan', detail: 'Update allocation amounts', href: '/plan', icon: 'plan' },
    { id: 'action-account', group: 'Actions' as const, title: 'Manage accounts', detail: 'Open account management', href: '/accounts/manage#contribution-room', icon: 'accounts' },
    { id: 'action-holding', group: 'Actions' as const, title: 'Add holding', detail: 'Open portfolio management', href: '/portfolio#holding-editor', icon: 'portfolio' },
  ];

  return (
    <>
      <DisplayPreferences userId={user.id} />
      <Nav profileName={profileName} searchItems={searchItems} />
      <main className="app-content-shell min-h-screen px-4 pb-8 pt-5 sm:px-6 md:ml-56 md:pl-10 md:pr-6 md:pb-12 md:pt-[75px]">{children}</main>
    </>
  );
}
