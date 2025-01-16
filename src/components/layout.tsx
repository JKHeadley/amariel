import React from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useRouter } from 'next/router';
import { Toaster } from 'react-hot-toast';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const isAdminRoute = router.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />
      {isAdminRoute && <AdminHeader />}
      <main className={`${isAdminRoute ? 'h-[calc(100vh-4rem)]' : 'h-screen'}`}>
        {children}
      </main>
    </div>
  );
} 