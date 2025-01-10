import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useTheme } from '@/styles/ThemeProvider';

interface AdminChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
}

export function AdminChatInput({ onSubmit, isLoading }: AdminChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const theme = useTheme();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    onSubmit(input);
    setInput('');
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(
        textareaRef.current.scrollHeight,
        16 * 24, // 16 lines * 1.5rem line height
      );
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  return (
    <form onSubmit={handleSubmit} className="relative">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder={isLoading ? "Thinking..." : "Message Amariel..."}
        className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 pr-12"
        style={{
          minHeight: '52px',
          maxHeight: '384px',
        }}
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors"
        style={{
          backgroundColor: theme.colors.primary,
          opacity: isLoading || !input.trim() ? 0.5 : 1,
        }}
      >
        <Send size={20} className="text-white" />
      </button>
    </form>
  );
} 