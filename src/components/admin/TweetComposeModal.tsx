import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';

interface TweetComposeModalProps {
  open: boolean;
  onClose: () => void;
  inReplyToId?: string;
  inReplyToText?: string;
  onSuccess?: () => void;
  type?: 'reply' | 'mention';
}

export function TweetComposeModal({
  open,
  onClose,
  inReplyToId,
  inReplyToText,
  onSuccess,
  type = 'reply'
}: TweetComposeModalProps) {
  const [text, setText] = useState('');
  const [isMockMode, setIsMockMode] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      const endpoint = isMockMode ? '/api/admin/x/mock-interaction' : '/api/admin/x/posts';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          inReplyToId,
          type: type,
          authorId: type === 'mention' ? process.env.X_USER_ID! : undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to post tweet');

      toast.success(isMockMode ? 'Mock interaction created' : 'Tweet posted successfully');
      setText('');
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error posting tweet:', error);
      toast.error('Failed to post tweet');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{type === 'mention' ? 'New Mention' : 'Compose Tweet'}</DialogTitle>
        </DialogHeader>
        {inReplyToText && (
          <div className="text-sm text-muted-foreground mb-4">
            Replying to: {inReplyToText}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={type === 'mention' ? '@SentientAmariel ' : "What's happening?"}
              className="min-h-[100px]"
            />
            <div className="flex items-center space-x-2">
              <Switch
                id="mock-mode"
                checked={isMockMode}
                onCheckedChange={setIsMockMode}
              />
              <Label htmlFor="mock-mode">Mock Mode</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                'Post'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 