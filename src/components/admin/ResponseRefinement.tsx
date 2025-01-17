import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageCircle, Send } from 'lucide-react';
import { useRouter } from 'next/router';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

interface Tweet {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  username: string;
  createdAt: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  type: 'CHAT' | 'THOUGHT';
  published?: boolean;
  metadata?: {
    mentionId?: string;
    authorId?: string;
  };
}

interface Chat {
  id: string;
  messages: Message[];
  mentions: Array<{
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    username: string;
    createdAt: string;
    conversationId?: string;
    inReplyToId?: string;
  }>;
  threadContext: Tweet[];
}

export function ResponseRefinement({ chatId }: { chatId: string }) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchChatAndContext = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching chat data for:', chatId);
        const response = await fetch(`/api/admin/chats/${chatId}/`);
        if (!response.ok) {
          throw new Error('Failed to fetch chat');
        }
        const data = await response.json();
        console.log('Received chat data:', data);
        setChat(data);
      } catch (error) {
        console.error('Error fetching chat:', error);
        toast.error('Failed to fetch chat');
      } finally {
        setIsLoading(false);
      }
    };

    if (chatId) {
      fetchChatAndContext();
    }
  }, [chatId]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      console.log('Sending message:', message);
      const response = await fetch(`/api/admin/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: message }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      console.log('Received response:', data);
      setChat(prevChat => ({
        ...prevChat!,
        messages: [...prevChat!.messages, data.message],
      }));
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handlePostResponse = async () => {
    const mention = chat?.mentions[0];
    const lastAssistantMessage = chat?.messages
      .filter(m => m.role === 'ASSISTANT' && !m.published)
      .pop();

    if (!mention || !lastAssistantMessage) {
      toast.error('No response available to post');
      return;
    }

    try {
      console.log('Posting response for mention:', mention.id);
      const response = await fetch(`/api/admin/x/mentions/${mention.id}/post`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to post response');
      }

      // Mark message as published
      setChat(prevChat => ({
        ...prevChat!,
        messages: prevChat!.messages.map(msg =>
          msg.id === lastAssistantMessage.id ? { ...msg, published: true } : msg
        ),
      }));

      toast.success('Response posted successfully');
      router.push('/admin'); // Return to admin view
    } catch (error) {
      console.error('Error posting response:', error);
      toast.error('Failed to post response');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  const mention = chat?.mentions[0];

  return (
    <div className="flex h-screen">
      {/* Context Panel */}
      <div className="w-1/3 border-r p-4">
        <Card className="h-full">
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Thread Context</h3>
            <div className="space-y-4">
              {chat?.threadContext.map((tweet) => (
                <div key={tweet.id} className="flex items-start gap-2">
                  <MessageCircle className="h-5 w-5 mt-1" />
                  <div>
                    <div className="font-medium">@{tweet.username}</div>
                    <p className="text-sm">{tweet.text}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(tweet.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {mention && (
                <div className="flex items-start gap-2 bg-accent/50 p-2 rounded-lg">
                  <MessageCircle className="h-5 w-5 mt-1" />
                  <div>
                    <div className="font-medium">@{mention.username}</div>
                    <p className="text-sm">{mention.text}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(mention.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {chat?.messages.map((msg) => (
              <Card key={msg.id} className="p-4">
                <div className="flex items-start gap-2">
                  <div className="font-medium capitalize">{msg.role}</div>
                  <div className="flex-1">
                    <p className="text-sm">{msg.content}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(msg.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                {msg.role === 'ASSISTANT' && !msg.published && (
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={handlePostResponse}
                      className="flex items-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Post to X
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message..."
              className="flex-1"
            />
            <Button onClick={handleSendMessage}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 