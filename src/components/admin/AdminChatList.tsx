import React from 'react';
import { useAdminStore } from '@/stores/useAdminStore';
import { MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChatActions } from './ChatActions';
import { Chat } from '@prisma/client';

export function AdminChatList() {
  const { chats, currentChat, setCurrentChat, createNewChat } = useAdminStore();

  const getChatTitle = (chat: Chat) => {
    return chat.title || `Chat ${chat.id.slice(0, 8)}`;
  };

  return (
    <Card className="w-64 h-full border-r relative z-50">
      <div className="p-4 border-b">
        <Button 
          onClick={() => createNewChat()}
          className="w-full"
        >
          New Chat
        </Button>
      </div>
      <div className="h-[calc(100%-5rem)] overflow-y-auto">
        <div className="p-4 space-y-2 flex flex-col">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-accent group ${
                currentChat?.id === chat.id ? 'bg-accent' : ''
              }`}
              onClick={() => setCurrentChat(chat)}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm truncate flex-1">
                {getChatTitle(chat)}
              </span>
              <div className="opacity-0 group-hover:opacity-100 flex-shrink-0">
                <ChatActions chat={chat} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
} 