import React, { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import {
  User,
  Settings,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import Image from 'next/image';

export function AdminUserMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!session) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 rounded-full bg-gray-100 p-2 hover:bg-gray-200 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
          {session.user?.email?.[0]?.toUpperCase() || <User size={20} />}
        </div>
        <span className="hidden md:inline text-sm text-gray-800 max-w-[150px] truncate">
          {session.user?.email}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
              {session.user?.email}
            </div>
            
            <button
              onClick={() => {
                router.push('/');
                setIsOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <div className="flex items-center">
                <LayoutDashboard size={16} className="mr-2" />
                Main Site
              </div>
            </button>

            <button
              onClick={() => {
                router.push('/admin/settings');
                setIsOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <div className="flex items-center">
                <Settings size={16} className="mr-2" />
                Settings
              </div>
            </button>

            <button
              onClick={() => {
                signOut({ callbackUrl: '/auth/signin' });
                setIsOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <div className="flex items-center">
                <LogOut size={16} className="mr-2" />
                Sign out
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 