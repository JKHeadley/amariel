import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Message } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SystemPromptCollapseProps {
  systemMessage: Message;
}

export function SystemPromptCollapse({ systemMessage }: SystemPromptCollapseProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-4">
      <Button
        variant="ghost"
        className="w-full flex items-center justify-between p-2 text-sm"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="font-medium">System Prompt</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>
      {isExpanded && (
        <Card className="mt-2">
          <div className="h-[300px]">
            <ScrollArea className="h-full">
              <div className="p-4 text-sm whitespace-pre-wrap text-muted-foreground">
                {systemMessage.content}
              </div>
            </ScrollArea>
          </div>
        </Card>
      )}
    </div>
  );
} 