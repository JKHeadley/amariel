import { useRouter } from 'next/router';
import { AdminUserMenu } from './AdminUserMenu';
import { MessageSquare } from 'lucide-react';

export function AdminHeader() {
  const router = useRouter();
  
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="h-16 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-800">
            Admin Dashboard
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <AdminUserMenu />
        </div>
      </div>
    </header>
  );
} 