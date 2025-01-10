import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Message } from '@prisma/client';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/styles/ThemeProvider';
import { AdminChatInput } from './AdminChatInput';
import { AdminChatMessage } from './AdminChatMessage';

export function AdminChatInterface() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    initializeChat();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChat = async () => {
    try {
      const response = await fetch('/api/chat/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to initialize chat');

      const { chat, messages } = await response.json();
      setCurrentChatId(chat.id);
      setMessages(messages);
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  };

  const handleSubmit = async (message: string) => {
    if (!message.trim() || !currentChatId) return;

    const newMessage = {
      role: 'user',
      content: message,
      createdAt: new Date(),
    } as Message;

    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          chatId: currentChatId,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const { response: aiResponse } = await response.json();

      const assistantMessage = {
        role: 'assistant',
        content: aiResponse,
        createdAt: new Date(),
      } as Message;

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-1 m-4 overflow-hidden">
        <ScrollArea ref={scrollRef} className="h-full p-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <AdminChatMessage key={index} message={message} />
            ))}
            {isLoading && (
              <div className="flex justify-center py-2">
                <div className="animate-pulse text-muted">Amariel is thinking...</div>
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
      <div className="p-4">
        <AdminChatInput onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
} 