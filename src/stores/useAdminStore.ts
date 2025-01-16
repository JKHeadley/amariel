import { create } from 'zustand';
import { Message, Chat, XAutomationMode } from '@prisma/client';

interface AdminState {
  chats: Chat[];
  currentChat: Chat | null;
  isLoading: boolean;
  xAutomationMode: XAutomationMode;
  lastMentionCheck: Date | null;
  
  setChats: (chats: Chat[]) => void;
  setCurrentChat: (chat: Chat | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  fetchChats: () => Promise<void>;
  createNewChat: () => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  addThoughtChat: (chat: Chat, message: Message) => void;
  updateChatTitle: (chatId: string, title: string) => Promise<void>;
  
  // X automation methods
  fetchSettings: () => Promise<void>;
  updateXAutomationMode: (mode: XAutomationMode) => Promise<void>;
  checkMentions: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  chats: [],
  currentChat: null,
  isLoading: false,
  xAutomationMode: 'SEMI_AUTOMATIC',
  lastMentionCheck: null,
  
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
      const response = await fetch('/api/admin/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to create chat');
      
      const chat = await response.json();
      set((state) => ({ 
        chats: [chat, ...state.chats],
        currentChat: chat,
      }));
    } catch (error) {
      console.error('Error creating chat:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteChat: async (chatId: string) => {
    try {
      set({ isLoading: true });
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
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async (content: string) => {
    const { currentChat } = get();
    if (!currentChat) return;

    try {
      set({ isLoading: true });
      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content,
          chatId: currentChat.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const { message, chat } = await response.json();
      set((state) => ({
        chats: state.chats.map((c) => (c.id === chat.id ? chat : c)),
        currentChat: chat,
      }));
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addThoughtChat: (chat: Chat, message: Message) => {
    set((state) => ({
      chats: [chat, ...state.chats.filter((c) => c.id !== chat.id)],
      currentChat: chat,
    }));
  },

  updateChatTitle: async (chatId: string, title: string) => {
    try {
      set({ isLoading: true });
      const response = await fetch(`/api/admin/chats/${chatId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ title }),
      });

      if (!response.ok) throw new Error('Failed to update chat title');
      
      const updatedChat = await response.json();
      set((state) => ({
        chats: state.chats.map((chat) => 
          chat.id === updatedChat.id ? updatedChat : chat
        ),
        currentChat: state.currentChat?.id === updatedChat.id 
          ? updatedChat 
          : state.currentChat,
      }));
    } catch (error) {
      console.error('Error updating chat title:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // X automation methods
  fetchSettings: async () => {
    try {
      const response = await fetch('/api/admin/settings', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch settings');

      const settings = await response.json();
      set({
        xAutomationMode: settings.xAutomationMode,
        lastMentionCheck: settings.lastMentionCheck ? new Date(settings.lastMentionCheck) : null,
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  },

  updateXAutomationMode: async (mode: XAutomationMode) => {
    try {
      set({ isLoading: true });
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ xAutomationMode: mode }),
      });

      if (!response.ok) throw new Error('Failed to update automation mode');

      const settings = await response.json();
      set({ xAutomationMode: settings.xAutomationMode });
    } catch (error) {
      console.error('Error updating automation mode:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  checkMentions: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch('/api/admin/x/check-mentions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to check mentions');

      const data = await response.json();
      set({ lastMentionCheck: new Date() });
      return data;
    } catch (error) {
      console.error('Error checking mentions:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
})); 