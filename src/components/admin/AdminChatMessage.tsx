import { Message } from '@prisma/client';
import { useTheme } from '@/styles/ThemeProvider';

interface AdminChatMessageProps {
  message: Message;
}

export function AdminChatMessage({ message }: AdminChatMessageProps) {
  const theme = useTheme();
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        <div className="text-sm font-medium mb-1">
          {isUser ? 'You' : 'Amariel'}
        </div>
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        <div className="text-xs opacity-70 mt-1">
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
} 