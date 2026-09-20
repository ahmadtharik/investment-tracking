'use client';

import { useRouter } from 'next/navigation';
import { useCallback, type ButtonHTMLAttributes, type ReactNode } from 'react';

type AccountManagerLinkProps = {
  account?: 'TFSA' | 'RRSP' | 'CASH';
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'>;

export function AccountManagerLink({ account, children, className, ...buttonProps }: AccountManagerLinkProps) {
  const router = useRouter();
  const open = useCallback(() => {
    const target = account === 'TFSA' ? 'tfsaRoom' : account === 'RRSP' ? 'rrspRoom' : 'record-contribution';
    router.push(`/accounts/manage${account ? `?account=${account}` : ''}#${target}`);
  }, [account, router]);
  return <button type="button" onClick={open} className={className} {...buttonProps}>{children}</button>;
}
