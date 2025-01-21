import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PostPage() {
  const router = useRouter();
  const { mentionId } = router.query;
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  useEffect(() => {
    const fetchResponse = async () => {
      if (!mentionId) return;
      
      try {
        const response = await fetch(`/api/admin/x/mentions/${mentionId}`);
        if (!response.ok) throw new Error('Failed to fetch mention');
        
        const data = await response.json();
        if (data.chat?.messages[0]?.content) {
          setResponse(data.chat.messages[0].content);
        }
      } catch (error) {
        console.error('Error fetching response:', error);
        toast.error('Failed to fetch response');
      }
    };

    fetchResponse();
  }, [mentionId]);

  const handlePost = async () => {
    if (!mentionId || !response) return;

    try {
      setLoading(true);
      const postResponse = await fetch(`/api/admin/x/mentions/${mentionId}/post`, {
        method: 'POST'
      });

      if (!postResponse.ok) {
        throw new Error('Failed to post response');
      }

      toast.success('Response posted successfully');
      router.push('/admin');
    } catch (error) {
      console.error('Error posting response:', error);
      toast.error('Failed to post response');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/admin');
  };

  if (!response) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Post Response</h1>
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
      </div>
      
      <div className="bg-muted p-4 rounded-lg">
        <div className="font-medium mb-2">Response to post:</div>
        <p>{response}</p>
      </div>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={handleBack}>
          Cancel
        </Button>
        <Button onClick={handlePost} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Post to X
        </Button>
      </div>
    </div>
  );
} 