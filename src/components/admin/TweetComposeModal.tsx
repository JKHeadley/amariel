import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';

interface TweetComposeModalProps {
  open: boolean;
  onClose: () => void;
  inReplyToId?: string;
  inReplyToText?: string;
  onSuccess?: () => void;
}

export function TweetComposeModal({ 
  open, 
  onClose, 
  inReplyToId,
  inReplyToText,
  onSuccess 
}: TweetComposeModalProps) {
  const [text, setText] = useState('');
  const [isMock, setIsMock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) {
      toast.error('Please enter some text');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/x/mock-interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: inReplyToId ? 'REPLY' : 'MENTION',
          text: text.trim(),
          username: 'user',  // We could make this configurable
          replyToId: inReplyToId,
          isMock
        })
      });

      if (!response.ok) throw new Error('Failed to post tweet');
      
      toast.success(isMock ? 'Mock tweet created' : 'Tweet posted');
      setText('');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Failed to post tweet');
      console.error('Error posting tweet:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{inReplyToId ? 'Reply to Tweet' : 'New Tweet'}</DialogTitle>
        </DialogHeader>
        
        {inReplyToText && (
          <div className="text-sm text-muted-foreground mb-4">
            Replying to: {inReplyToText}
          </div>
        )}

        <div className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
            className="min-h-[100px]"
          />
          
          <div className="flex items-center space-x-2">
            <Switch
              id="mock-mode"
              checked={isMock}
              onCheckedChange={setIsMock}
            />
            <Label htmlFor="mock-mode">Mock Mode</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !text.trim()}
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 