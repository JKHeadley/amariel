import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageCircle, Repeat2, Heart, AlertCircle, Clock } from 'lucide-react';
import { Countdown } from '@/components/ui/countdown';
import toast from 'react-hot-toast';
import { MockInteractionDialog } from './MockInteractionDialog';

interface Post {
  id: string;
  text: string;
  createdAt: string;
  metrics: {
    replyCount: number;
    retweetCount: number;
    likeCount: number;
  };
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export function PostsList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

  const formatTimeUntilReset = (resetTimestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const secondsUntilReset = Math.max(0, resetTimestamp - now);
    const minutes = Math.floor(secondsUntilReset / 60);
    const seconds = secondsUntilReset % 60;
    return `${minutes}m ${seconds}s`;
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (rateLimitInfo?.reset) {
      // Update immediately
      setCountdown(formatTimeUntilReset(rateLimitInfo.reset));

      // Then update every second
      intervalId = setInterval(() => {
        const timeLeft = formatTimeUntilReset(rateLimitInfo.reset);
        setCountdown(timeLeft);

        // Clear interval if we've reached 0
        if (timeLeft === '0m 0s') {
          setRateLimitInfo(null);
          clearInterval(intervalId);
        }
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [rateLimitInfo?.reset]);

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/admin/x/posts', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Check rate limit headers
      const rateLimitLimit = response.headers.get('x-rate-limit-limit');
      const rateLimitRemaining = response.headers.get('x-rate-limit-remaining');
      const rateLimitReset = response.headers.get('x-rate-limit-reset');

      if (rateLimitLimit && rateLimitRemaining && rateLimitReset) {
        console.log('Rate limit info:', {
          limit: rateLimitLimit,
          remaining: rateLimitRemaining,
          reset: rateLimitReset
        });
        setRateLimitInfo({
          limit: parseInt(rateLimitLimit),
          remaining: parseInt(rateLimitRemaining),
          reset: parseInt(rateLimitReset),
        });
      }

      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();
      setPosts(data.posts);
      setFromCache(data.fromCache);
      
      if (data.error) {
        toast.error(data.error);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
      toast.error('Failed to fetch posts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Posts</h2>
        <div className="flex items-center gap-4">
          {fromCache && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Showing cached posts</span>
            </div>
          )}
          {rateLimitInfo && rateLimitInfo.remaining === 0 && countdown && (
            <Countdown timeLeft={countdown} />
          )}
          <MockInteractionDialog 
            onInteractionCreated={fetchPosts}
            availablePosts={posts.map(post => ({
              id: post.id,
              text: post.text
            }))}
          />
          <Button 
            onClick={fetchPosts} 
            disabled={isLoading || (rateLimitInfo?.remaining === 0)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {rateLimitInfo && rateLimitInfo.remaining === 0 && (
        <Card className="p-4 mb-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900">Rate Limit Exceeded</h3>
              <p className="text-sm text-yellow-800 mt-1">
                X API rate limit reached. You can make {rateLimitInfo.limit} request(s) per time window.
                {fromCache && ' Showing cached posts.'} {countdown && `Rate limit resets in ${countdown}.`}
              </p>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : error ? (
        <Card className="p-4">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="space-y-4">
                <p className="text-sm">{post.text}</p>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>{formatDate(post.createdAt)}</span>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <MessageCircle size={16} />
                      <span>{post.metrics.replyCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Repeat2 size={16} />
                      <span>{post.metrics.retweetCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart size={16} />
                      <span>{post.metrics.likeCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 