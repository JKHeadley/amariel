import React, { useEffect } from 'react';
import { useAdminStore } from '@/stores/useAdminStore';
import { AdminChatList } from './AdminChatList';
import { AdminChatInput } from './AdminChatInput';
import { AdminChatMessage } from './AdminChatMessage';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function AdminChatInterface() {
  const { currentChat, fetchChats, isLoading } = useAdminStore();

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  return (
    <div className="flex h-full">
      <AdminChatList />
      
      <div className="flex-1 flex flex-col h-full">
        {currentChat ? (
          <>
            <Card className="flex-1 m-4 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-4">
                  {currentChat.messages?.map((message, index) => (
                    <AdminChatMessage key={index} message={message} />
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