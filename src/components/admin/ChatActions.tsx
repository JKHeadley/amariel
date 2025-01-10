import React, { useState } from 'react';
import { MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Chat } from '@prisma/client';
import { useAdminStore } from '@/stores/useAdminStore';

interface ChatActionsProps {
  chat: Chat;
}

export function ChatActions({ chat }: ChatActionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(chat.title || '');
  const { deleteChat, updateChatTitle } = useAdminStore();

  const handleRename = async () => {
    if (!title.trim()) return;
    await updateChatTitle(chat.id, title);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRename();
        }}
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-7 text-sm"
          placeholder="Chat name..."
          autoFocus
          onBlur={handleRename}
        />
      </form>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setIsEditing(true)}>
          <Edit2 className="mr-2 h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => deleteChat(chat.id)}
          className="text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 