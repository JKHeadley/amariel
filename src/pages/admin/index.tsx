import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Layout from '@/components/layout';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/styles/ThemeProvider';
import { UserRole } from '@prisma/client';
import { AdminAnalyticsDashboard } from '@/components/admin/AdminAnalyticsDashboard';
import { AdminChatInterface } from '@/components/admin/AdminChatInterface';
import {
  BarChart3, Settings, Gift, Users, Mail,
  MessageSquare, CreditCard, AlertCircle, Activity
} from 'lucide-react';

const tabs = [
  {
    name: 'Overview',
    icon: Activity,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100'
  },
  {
    name: 'Messages',
    icon: MessageSquare,
    color: 'text-purple-500',
    bgColor: 'bg-purple-100'
  },
  {
    name: 'Users',
    icon: Users,
    color: 'text-green-500',
    bgColor: 'bg-green-100'
  },
  {
    name: 'Credits',
    icon: CreditCard,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100'
  },
  {
    name: 'Alerts',
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-100'
  }
];

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const theme = useTheme();
  const [selectedTab, setSelectedTab] = useState(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (status === 'loading' || !isClient) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
        </div>
      </Layout>
    );
  }

  const renderContent = () => {
    switch (selectedTab) {
      case 0:
        return <AdminAnalyticsDashboard />;
      case 1:
        return <AdminChatInterface />;
      case 2:
        return <div>Users content</div>;
      case 3:
        return <div>Credits content</div>;
      case 4:
        return <div>Alerts content</div>;
      default:
        return <AdminAnalyticsDashboard />;
    }
  };

  return (
    <Layout>
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-64 border-r h-full flex-shrink-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {tabs.map((tab, index) => (
                <button
                  key={tab.name}
                  onClick={() => setSelectedTab(index)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                    selectedTab === index 
                      ? `${tab.bgColor} ${tab.color}`
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="font-medium">{tab.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
} 