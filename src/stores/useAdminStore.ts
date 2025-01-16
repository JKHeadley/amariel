import { create } from 'zustand';
import { Message, Chat } from '@prisma/client';

interface AdminState {
  chats: Chat[];
  currentChat: Chat | null;
  isLoading: boolean;
  setChats: (chats: Chat[]) => void;
  setCurrentChat: (chat: Chat | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  fetchChats: () => Promise<void>;
  createNewChat: () => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  addThoughtChat: (chat: Chat, message: Message) => void;
  updateChatTitle: (chatId: string, title: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  chats: [],
  currentChat: null,
  isLoading: false,
  
  setChats: (chats) => set({ chats }),
  setCurrentChat: (chat) => set({ currentChat: chat }),
  setIsLoading: (isLoading) => set({ isLoading }),
  
  fetchChats: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch('/api/admin/chats', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.error('Unauthorized: User must be admin');
          return;
        }
        throw new Error('Failed to fetch chats');
      }
      
      const chats = await response.json();
      set({ chats });
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createNewChat: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch('/api/chat/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to create chat');
      const { chat } = await response.json();
      set((state) => ({ 
        chats: [chat, ...state.chats],
        currentChat: chat 
      }));
    } catch (error) {
      console.error('Error creating chat:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteChat: async (chatId: string) => {
    try {
      const response = await fetch(`/api/admin/chats/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to delete chat');
      set((state) => ({
        chats: state.chats.filter((chat) => chat.id !== chatId),
        currentChat: state.currentChat?.id === chatId ? null : state.currentChat,
      }));
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  },

  sendMessage: async (content: string) => {
    const currentChat = get().currentChat;
    if (!currentChat) return;

    try {
      console.log('🚀 Starting message send process:', { chatId: currentChat.id, content });
      set({ isLoading: true });

      // Add user message immediately
      const userMessage: Message = {
        id: Date.now().toString(),
        chatId: currentChat.id,
        content,
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Message;

      console.log('📝 Adding user message to UI:', userMessage);
      set((state) => ({
        currentChat: state.currentChat ? {
          ...state.currentChat,
          messages: [...(state.currentChat.messages || []), userMessage],
        } : null,
      }));

      // Check if this is a thought chat
      const isThoughtChat = currentChat.messages?.some(m => m.type === 'THOUGHT');
      console.log('💭 Is thought chat?', isThoughtChat);

      // Send message to appropriate endpoint
      const endpoint = isThoughtChat ? '/api/admin/thoughts/generate' : '/api/chat';
      console.log('🎯 Sending to endpoint:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: content,
          chatId: currentChat.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      if (isThoughtChat) {
        const { message: thoughtMessage, chat: newChat } = await response.json();
        console.log('💡 Received thought response:', { thoughtMessage, chatId: newChat.id });
        
        set((state) => {
          console.log('🔄 Updating state with thought:', {
            existingMessages: state.currentChat?.messages?.length || 0,
            addingMessages: 2 // user message + thought message
          });
          return {
            chats: [newChat, ...state.chats.filter(c => c.id !== currentChat.id)],
            currentChat: {
              ...newChat,
              messages: [...(state.currentChat?.messages || []), userMessage, thoughtMessage],
            },
          };
        });
      } else {
        const { response: aiResponse } = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          chatId: currentChat.id,
          content: aiResponse,
          role: 'ASSISTANT',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Message;

        set((state) => ({
          currentChat: state.currentChat ? {
            ...state.currentChat,
            messages: [...(state.currentChat.messages || []), assistantMessage],
          } : null,
          chats: state.chats.map((chat) =>
            chat.id === currentChat.id
              ? {
                  ...chat,
                  messages: [...(chat.messages || []), userMessage, assistantMessage],
                }
              : chat
          ),
        }));
      }
    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
    } finally {
      console.log('✅ Message send process complete');
      set({ isLoading: false });
    }
  },

  addThoughtChat: (chat, message) => {
    const chatWithMessage = {
      ...chat,
      messages: [message],
    };
    set((state) => ({ 
      chats: [chatWithMessage, ...state.chats],
      currentChat: chatWithMessage 
    }));
  },

  updateChatTitle: async (chatId: string, title: string) => {
    try {
      const response = await fetch(`/api/admin/chats/${chatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ title }),
      });
      
      if (!response.ok) throw new Error('Failed to update chat title');

      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === chatId ? { ...chat, title } : chat
        ),
        currentChat: state.currentChat?.id === chatId
          ? { ...state.currentChat, title }
          : state.currentChat,
      }));
    } catch (error) {
      console.error('Error updating chat title:', error);
    }
  },
})); 