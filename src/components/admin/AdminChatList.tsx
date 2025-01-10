import React from 'react';
import { useAdminStore } from '@/stores/useAdminStore';
import { MessageSquare, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

export function AdminChatList() {
  const { chats, currentChat, setCurrentChat, createNewChat, deleteChat } = useAdminStore();

  const getChatTitle = (chat: Chat) => {
    return chat.title || 
           chat.user?.username || 
           chat.user?.email?.split('@')[0] || 
           `Chat ${chat.id.slice(0, 8)}`;
  };

  return (
    <Card className="w-64 h-full border-r">
      <div className="p-4 border-b">
        <Button 
          onClick={() => createNewChat()}
          className="w-full"
        >
          New Chat
        </Button>
      </div>
      <ScrollArea className="h-[calc(100%-5rem)]">
        <div className="p-4 space-y-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-accent ${
                currentChat?.id === chat.id ? 'bg-accent' : ''
              }`}
              onClick={() => setCurrentChat(chat)}
            >
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm truncate">
                  {getChatTitle(chat)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(chat.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
} 