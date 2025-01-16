import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MessageSquarePlus } from 'lucide-react';
import toast from 'react-hot-toast';

type InteractionType = 'MENTION' | 'REPLY';

interface MockInteractionDialogProps {
  onInteractionCreated: () => void;
  availablePosts?: Array<{ id: string; text: string }>;
}

export function MockInteractionDialog({ onInteractionCreated, availablePosts = [] }: MockInteractionDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<InteractionType>('MENTION');
  const [text, setText] = useState('');
  const [username, setUsername] = useState('');
  const [replyToId, setReplyToId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/x/mock-interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          text,
          username,
          replyToId: type === 'REPLY' ? replyToId : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create mock interaction');
      }

      toast.success(`Mock ${type.toLowerCase()} created successfully`);
      setOpen(false);
      onInteractionCreated();
      
      // Reset form
      setText('');
      setUsername('');
      setReplyToId('');
    } catch (error) {
      console.error('Error creating mock interaction:', error);
      toast.error('Failed to create mock interaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageSquarePlus className="h-4 w-4" />
          Create Mock Interaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Mock Interaction</DialogTitle>
          <DialogDescription>
            Create a mock mention or reply to test Amariel's response handling.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Interaction Type</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as InteractionType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="MENTION" id="mention" />
                <Label htmlFor="mention">Mention</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="REPLY" id="reply" />
                <Label htmlFor="reply">Reply</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="mock_user123"
              required
            />
          </div>

          {type === 'REPLY' && availablePosts.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="replyTo">Reply to Post</Label>
              <select
                id="replyTo"
                value={replyToId}
                onChange={(e) => setReplyToId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                required
              >
                <option value="">Select a post</option>
                {availablePosts.map((post) => (
                  <option key={post.id} value={post.id}>
                    {post.text.substring(0, 50)}...
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="text">Message</Label>
            <Textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={type === 'MENTION' ? '@SentientAmariel Hey there!' : 'Your reply message...'}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 