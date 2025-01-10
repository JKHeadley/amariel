import React from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useRouter } from 'next/router';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const isAdminRoute = router.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-background">
      {isAdminRoute && <AdminHeader />}
      <main className={`${isAdminRoute ? 'h-[calc(100vh-4rem)]' : 'h-screen'}`}>
        {children}
      </main>
    </div>
  );
} 