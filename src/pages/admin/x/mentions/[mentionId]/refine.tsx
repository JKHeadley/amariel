import { ResponseRefinement } from '@/components/admin/ResponseRefinement';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function RefinePage() {
  const router = useRouter();
  const { mentionId } = router.query;
  const [chatId, setChatId] = useState<string | null>(null);

  useEffect(() => {
    const fetchChatId = async () => {
      if (!mentionId) return;
      
      try {
        const response = await fetch(`/api/admin/x/mentions/${mentionId}`);
        if (!response.ok) throw new Error('Failed to fetch mention');
        
        const data = await response.json();
        if (data.chat?.id) {
          setChatId(data.chat.id);
        }
      } catch (error) {
        console.error('Error fetching chat ID:', error);
      }
    };

    fetchChatId();
  }, [mentionId]);

  if (!chatId) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return <ResponseRefinement chatId={chatId} />;
} 