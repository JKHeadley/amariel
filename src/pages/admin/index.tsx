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
import { AdminThoughtInterface } from '@/components/admin/AdminThoughtInterface';
import { XAutomationSettings } from '@/components/admin/XAutomationSettings';
import { PostsList } from '@/components/admin/PostsList';
import { useAdminStore } from '@/stores/useAdminStore';
import {
  Activity,
  MessageSquare,
  BrainCircuit,
  Settings,
  FileText
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
    name: 'Thoughts',
    icon: BrainCircuit,
    color: 'text-pink-500',
    bgColor: 'bg-pink-100'
  },
  {
    name: 'Posts',
    icon: FileText,
    color: 'text-green-500',
    bgColor: 'bg-green-100'
  },
  {
    name: 'Settings',
    icon: Settings,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100'
  }
];

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const theme = useTheme();
  const [selectedTab, setSelectedTab] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const { xAutomationMode, lastMentionCheck, updateXAutomationMode, checkMentions, fetchSettings } = useAdminStore();

  useEffect(() => {
    setIsClient(true);
    fetchSettings();
  }, [fetchSettings]);

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
        return <AdminThoughtInterface />;
      case 3:
        return <PostsList />;
      case 4:
        return (
          <div className="p-6 max-w-2xl mx-auto">
            <XAutomationSettings
              currentMode={xAutomationMode}
              lastCheck={lastMentionCheck}
              onModeChange={updateXAutomationMode}
              onCheckMentions={checkMentions}
            />
          </div>
        );
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