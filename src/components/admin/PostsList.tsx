import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Repeat, Heart, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { TweetComposeModal } from './TweetComposeModal';
import { useRouter } from 'next/router';

interface Post {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  username: string;
  createdAt: Date;
  metrics: {
    replyCount: number;
    retweetCount: number;
    likeCount: number;
  };
  isMock?: boolean;
  inReplyToId?: string | null;
  conversationId?: string | null;
  type?: 'MENTION' | 'REPLY' | 'POST';
}

interface Thread {
  originalPost: Post;
  reply: Post;
}

interface Mention {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  username: string;
  createdAt: Date;
  processed: boolean;
  ignored: boolean;
  isMock?: boolean;
  metrics: {
    replyCount: number;
    retweetCount: number;
    likeCount: number;
  };
}

interface PendingMentionWithResponse extends Mention {
  status: 'PENDING' | 'PROCESSING' | 'RESPONDED' | 'FAILED' | 'IGNORED';
  chat?: {
    id: string;
    messages: {
      content: string;
      role: string;
    }[];
  };
}

function ThreadView({ thread, onBack }: { thread: Post[]; onBack: () => void }) {
  const [replyToPost, setReplyToPost] = useState<Post | null>(null);
  const [nestedThread, setNestedThread] = useState<Post[] | null>(null);

  const handlePostClick = async (post: Post) => {
    try {
      console.log('🔍 Fetching thread for post:', post.id);
      const response = await fetch(`/api/admin/x/posts/${post.id}/thread`);
      if (!response.ok) throw new Error('Failed to fetch thread');
      const data = await response.json();
      setNestedThread(data.thread);
    } catch (error) {
      toast.error('Failed to fetch thread');
    }
  };

  // If we're viewing a nested thread
  if (nestedThread) {
    return (
      <ThreadView 
        thread={nestedThread} 
        onBack={() => setNestedThread(null)} 
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <Button variant="ghost" onClick={onBack} className="mb-2">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-xl font-bold">Thread</h2>
      </div>
      <ScrollArea className="flex-grow">
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {thread.map((post, index) => (
            <Card 
              key={post.id} 
              className={`hover:bg-accent/50 cursor-pointer transition-colors ${post.isMock ? 'border-blue-500' : ''}`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                handlePostClick(post);
              }}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-lg">{post.authorName}</div>
                    <div className="text-sm text-muted-foreground">@{post.username}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <p className="mb-4 text-base">{post.text}</p>
                <PostActions 
                  post={post} 
                  onReplyClick={(e) => {
                    e.stopPropagation();
                    setReplyToPost(post);
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <TweetComposeModal
        open={replyToPost !== null}
        onClose={() => setReplyToPost(null)}
        inReplyToId={replyToPost?.id}
        inReplyToText={replyToPost?.text}
        onSuccess={() => {
          // Refresh the thread data
          handlePostClick(thread[0]); // Refresh using the root post
          setReplyToPost(null);
        }}
      />
    </div>
  );
}

function PostActions({ post, onReplyClick }: { post: Post; onReplyClick: (e: React.MouseEvent) => void }) {
  return (
    <div className="flex gap-6 text-sm text-muted-foreground">
      <button 
        onClick={onReplyClick}
        className="flex items-center gap-1 hover:text-primary transition-colors"
      >
        <MessageCircle className="h-4 w-4" />
        <span>{post.metrics.replyCount}</span>
      </button>
      <button className="flex items-center gap-1 hover:text-primary transition-colors">
        <Repeat className="h-4 w-4" />
        <span>{post.metrics.retweetCount}</span>
      </button>
      <button className="flex items-center gap-1 hover:text-primary transition-colors">
        <Heart className="h-4 w-4" />
        <span>{post.metrics.likeCount}</span>
      </button>
      {post.isMock && <span className="text-blue-500">Mock</span>}
    </div>
  );
}

export function PostsList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Thread[]>([]);
  const [mentions, setMentions] = useState<Post[]>([]);
  const [pendingMentions, setPendingMentions] = useState<PendingMentionWithResponse[]>([]);
  const [selectedThread, setSelectedThread] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState({
    posts: true,
    replies: true,
    mentions: true,
    pending: true,
    sync: false
  });
  const [error, setError] = useState<string | null>(null);
  const [replyToPost, setReplyToPost] = useState<Post | null>(null);
  const [mentionModalOpen, setMentionModalOpen] = useState(false);
  const [generatingResponses, setGeneratingResponses] = useState<Set<string>>(new Set());
  const [generatingAll, setGeneratingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        
        // Load data based on active tab
        switch (activeTab) {
          case 'posts':
            if (posts.length === 0) {
              setLoading(prev => ({ ...prev, posts: true }));
              const response = await fetch('/api/admin/x/posts');
              if (!response.ok) throw new Error('Failed to fetch posts');
              const data = await response.json();
              setPosts(data.posts);
            }
            break;
            
          case 'replies':
            if (replies.length === 0) {
              setLoading(prev => ({ ...prev, replies: true }));
              const response = await fetch('/api/admin/x/replies');
              if (!response.ok) throw new Error('Failed to fetch replies');
              const data = await response.json();
              setReplies(data.threads);
            }
            break;
            
          case 'mentions':
            if (mentions.length === 0) {
              setLoading(prev => ({ ...prev, mentions: true }));
              const response = await fetch('/api/admin/x/mentions');
              if (!response.ok) throw new Error('Failed to fetch mentions');
              const data = await response.json();
              setMentions(data.mentions);
            }
            break;
            
          case 'pending':
            if (pendingMentions.length === 0) {
              setLoading(prev => ({ ...prev, pending: true }));
              const response = await fetch('/api/admin/x/mentions/pending');
              if (!response.ok) throw new Error('Failed to fetch pending mentions');
              const data = await response.json();
              setPendingMentions(data.mentions);
            }
            break;
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(prev => ({ ...prev, [activeTab]: false }));
      }
    };

    loadData();
  }, [activeTab]);

  const handlePostClick = async (post: Post) => {
    try {
      const response = await fetch(`/api/admin/x/threads/${post.id}`);
      if (!response.ok) throw new Error('Failed to fetch thread');
      const data = await response.json();
      setSelectedThread(data.thread);
    } catch (error) {
      console.error('Error fetching thread:', error);
      toast.error('Failed to fetch thread');
    }
  };

  const generateAllResponses = async () => {
    try {
      setGeneratingAll(true);
      const response = await fetch('/api/admin/x/mentions/generate-all', {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to generate responses');
      setPendingMentions([]); // Reset to trigger a refresh
    } catch (error) {
      console.error('Error generating responses:', error);
      toast.error('Failed to generate responses');
    } finally {
      setGeneratingAll(false);
    }
  };

  const generateResponse = async (mentionId: string) => {
    try {
      setGeneratingResponses(prev => {
        const next = new Set(prev);
        next.add(mentionId);
        return next;
      });
      const response = await fetch(`/api/admin/x/mentions/${mentionId}/generate`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to generate response');
      const data = await response.json();
      setPendingMentions([]); // Reset to trigger a refresh
      
      // Redirect to the chat for response refinement
      if (data.chat?.id) {
        router.push(`/admin/chats/${data.chat.id}`);
      }
    } catch (error) {
      console.error('Error generating response:', error);
      toast.error('Failed to generate response');
    } finally {
      setGeneratingResponses(prev => {
        const next = new Set(prev);
        next.delete(mentionId);
        return next;
      });
    }
  };

  const handleReplyClick = (post: Post) => {
    setReplyToPost(post);
  };

  const handleSync = async () => {
    try {
      setLoading(prev => ({ ...prev, sync: true }));
      const response = await fetch('/api/admin/x/sync', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync X data');
      }
      
      // Reset all data to trigger a refresh
      setPosts([]);
      setReplies([]);
      setMentions([]);
      setPendingMentions([]);
      
      toast.success('Successfully synced X data');
    } catch (error) {
      console.error('Error syncing X data:', error);
      toast.error('Failed to sync X data');
    } finally {
      setLoading(prev => ({ ...prev, sync: false }));
    }
  };

  const renderPost = (post: Post | Mention) => {
    // Helper to safely get metrics
    const getMetrics = (item: Post | Mention) => {
      if ('metrics' in item && item.metrics) {
        return item.metrics as { replyCount: number; retweetCount: number; likeCount: number };
      }
      return { replyCount: 0, retweetCount: 0, likeCount: 0 };
    };

    const metrics = getMetrics(post);

    return (
      <Card 
        key={post.id} 
        className={`hover:bg-accent/50 cursor-pointer transition-colors ${post.isMock ? 'border-blue-500' : ''}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          handlePostClick(post);
        }}
      >
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-bold text-lg">{post.authorName}</div>
              <div className="text-sm text-muted-foreground">@{post.username}</div>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </div>
          </div>
          <p className="mb-4 text-base">{post.text}</p>
          <div className="flex gap-4">
            <button 
              className="flex items-center gap-1 hover:text-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleReplyClick(post);
              }}
            >
              <MessageCircle className="h-4 w-4" />
              <span>{metrics.replyCount}</span>
            </button>
            <button className="flex items-center gap-1 hover:text-primary transition-colors">
              <Repeat className="h-4 w-4" />
              <span>{metrics.retweetCount}</span>
            </button>
            <button className="flex items-center gap-1 hover:text-primary transition-colors">
              <Heart className="h-4 w-4" />
              <span>{metrics.likeCount}</span>
            </button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderThread = (thread: Thread) => (
    <div key={thread.reply.id} className="space-y-4">
      {renderPost(thread.originalPost)}
      <div className="border-l-2 border-muted-foreground/20 ml-8 pl-8">
        {renderPost(thread.reply)}
      </div>
    </div>
  );

  const renderPendingMention = (mention: PendingMentionWithResponse) => {
    const latestResponse = mention.chat?.messages[0]?.content;
    const isProcessing = mention.status === 'PROCESSING';

    const handleReset = async () => {
      try {
        const response = await fetch(`/api/admin/x/mentions/${mention.id}/reset`, {
          method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to reset mention');
        
        // Reset pending mentions to trigger a refresh
        setPendingMentions([]);
        toast.success('Successfully reset mention');
      } catch (error) {
        console.error('Error resetting mention:', error);
        toast.error('Failed to reset mention');
      }
    };

    return (
      <div key={mention.id} className="border rounded-lg p-4 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-medium">{mention.authorName}</div>
            <div className="text-sm text-muted-foreground">@{mention.username}</div>
          </div>
          {isProcessing ? (
            <div className="flex gap-2">
              <Button 
                variant="default"
                onClick={() => {
                  router.push(`/admin/x/mentions/${mention.id}/refine`);
                  // Reset pending mentions to trigger a refresh when returning
                  setPendingMentions([]);
                }}
              >
                Refine
              </Button>
              <Button 
                variant="default"
                onClick={() => {
                  router.push(`/admin/x/mentions/${mention.id}/post`);
                  // Reset pending mentions to trigger a refresh when returning
                  setPendingMentions([]);
                }}
              >
                Post to X
              </Button>
              <Button 
                variant="outline"
                onClick={handleReset}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                Reset
              </Button>
            </div>
          ) : (
            <Button 
              variant="default"
              onClick={() => generateResponse(mention.id)}
              disabled={generatingResponses.has(mention.id)}
            >
              {generatingResponses.has(mention.id) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Generate Response
            </Button>
          )}
        </div>
        <p>{mention.text}</p>
        {isProcessing && latestResponse && (
          <div className="bg-muted p-4 rounded-lg">
            <div className="font-medium mb-2">Generated Response:</div>
            <p>{latestResponse}</p>
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <div className="text-destructive mb-4">Error: {error}</div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (selectedThread) {
    return (
      <ThreadView 
        thread={selectedThread} 
        onBack={() => setSelectedThread(null)} 
      />
    );
  }

  return (
    <>
      <div className="h-[calc(100vh-4rem)]">
        <Tabs 
          defaultValue="posts" 
          className="h-full flex flex-col"
          onValueChange={setActiveTab}
          value={activeTab}
        >
          <div className="flex justify-between items-center mx-4 mb-4">
            <TabsList>
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="replies">Replies</TabsTrigger>
              <TabsTrigger value="mentions">Mentions</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={loading.sync}
                className="flex items-center gap-2"
              >
                {loading.sync ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Fetch X Data
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const response = await fetch('/api/admin/x/hydrate', {
                      method: 'POST'
                    });
                    if (!response.ok) throw new Error('Failed to hydrate tweets');
                    const data = await response.json();
                    toast.success(`Successfully hydrated ${data.hydrated} tweets`);
                    // Reset posts to trigger a refresh
                    setPosts([]);
                  } catch (error) {
                    console.error('Error hydrating tweets:', error);
                    toast.error('Failed to hydrate tweets');
                  }
                }}
              >
                Hydrate Tweets
              </Button>
              <Button 
                variant="outline"
                onClick={() => setMentionModalOpen(true)}
              >
                Mock Mention
              </Button>
              {activeTab === 'pending' && (
                <Button
                  variant="default"
                  onClick={generateAllResponses}
                  disabled={generatingAll || pendingMentions.every(m => m.status === 'PROCESSING')}
                >
                  {generatingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate All Responses
                </Button>
              )}
            </div>
          </div>

          <div className="flex-grow overflow-hidden">
            <TabsContent value="posts" className="h-full m-0">
              <ScrollArea className="h-full">
                {loading.posts ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto py-4 space-y-6">
                    {posts.length === 0 ? (
                      <div className="text-center text-muted-foreground">No posts found</div>
                    ) : (
                      posts.map(renderPost)
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="replies" className="h-full m-0">
              <ScrollArea className="h-full">
                {loading.replies ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto py-4 space-y-6">
                    {replies.length === 0 ? (
                      <div className="text-center text-muted-foreground">No replies found</div>
                    ) : (
                      replies.map(renderThread)
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="mentions" className="h-full m-0">
              <ScrollArea className="h-full">
                {loading.mentions ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto py-4 space-y-6">
                    {mentions.length === 0 ? (
                      <div className="text-center text-muted-foreground">No mentions found</div>
                    ) : (
                      mentions.map(renderPost)
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="pending" className="h-full m-0">
              <ScrollArea className="h-full">
                {loading.pending ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto py-4 space-y-6">
                    {pendingMentions.length === 0 ? (
                      <div className="text-center text-muted-foreground">No pending mentions found</div>
                    ) : (
                      pendingMentions.map(renderPendingMention)
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {replyToPost && (
        <TweetComposeModal
          open={!!replyToPost}
          onClose={() => setReplyToPost(null)}
          inReplyToId={replyToPost.id}
          inReplyToText={replyToPost.text}
          onSuccess={() => {
            // Reset data for the active tab to trigger a refresh
            switch (activeTab) {
              case 'posts':
                setPosts([]);
                break;
              case 'replies':
                setReplies([]);
                break;
              case 'mentions':
                setMentions([]);
                break;
              case 'pending':
                setPendingMentions([]);
                break;
            }
          }}
          type="reply"
        />
      )}

      <TweetComposeModal
        open={mentionModalOpen}
        onClose={() => setMentionModalOpen(false)}
        onSuccess={() => {
          // Reset pending mentions to trigger a refresh
          setPendingMentions([]);
        }}
        type="mention"
      />
    </>
  );
} 