import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AdminChatMessage } from './AdminChatMessage';
import { AdminChatInput } from './AdminChatInput';
import { useAdminStore } from '@/stores/useAdminStore';
import { Send } from 'lucide-react';
import { AdminChatList } from './AdminChatList';

export function AdminThoughtInterface() {
  const { currentChat, isLoading, addThoughtChat, fetchChats } = useAdminStore();

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const handleGenerateThought = async () => {
    try {
      const response = await fetch('/api/admin/thoughts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          chatId: currentChat?.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate thought');
      
      const { message, chat } = await response.json();
      addThoughtChat(chat, message);

    } catch (error) {
      console.error('Error generating thought:', error);
    }
  };

  const handlePublishThought = async (messageId: string) => {
    try {
      const response = await fetch('/api/admin/thoughts/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          messageId,
        }),
      });

      if (!response.ok) throw new Error('Failed to publish thought');
    } catch (error) {
      console.error('Error publishing thought:', error);
    }
  };

  return (
    <div className="flex h-full">
      <AdminChatList />
      
      <div className="flex-1 flex flex-col h-full">
        {currentChat ? (
          <>
            <div className="p-4">
              <Button 
                onClick={handleGenerateThought}
                disabled={isLoading}
                className="w-full"
              >
                Generate X Post
              </Button>
            </div>
            <Card className="flex-1 mx-4 mb-4 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-4">
                  {currentChat.messages?.map((message) => (
                    <div key={message.id}>
                      <AdminChatMessage message={message} />
                      {message.role === 'ASSISTANT' && message.type === 'THOUGHT' && !message.published && (
                        <div className="flex justify-end mt-2">
                          <Button
                            size="sm"
                            onClick={() => handlePublishThought(message.id)}
                            className="flex items-center gap-2"
                          >
                            <Send size={16} />
                            Publish to X
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-center py-2">
                      <div className="animate-pulse text-muted">
                        Amariel is thinking...
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>
            <div className="p-4">
              <AdminChatInput />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted">
            Select a chat or create a new one
          </div>
        )}
      </div>
    </div>
  );
} 