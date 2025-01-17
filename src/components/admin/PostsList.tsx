import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Repeat, Heart, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { TweetComposeModal } from './TweetComposeModal';

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
  generatedResponse?: {
    text: string;
    chatId: string;
  };
}

function ThreadView({ thread, onBack }: { thread: Post[]; onBack: () => void }) {
  const [replyToPost, setReplyToPost] = useState<Post | null>(null);
  const [nestedThread, setNestedThread] = useState<Post[] | null>(null);

  const handlePostClick = async (post: Post) => {
    try {
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
  const [loading, setLoading] = useState(true);
  const [replyToPost, setReplyToPost] = useState<Post | null>(null);
  const [mentionModalOpen, setMentionModalOpen] = useState(false);
  const [generatingResponses, setGeneratingResponses] = useState<Set<string>>(new Set());
  const [generatingAll, setGeneratingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    fetchPosts();
    fetchReplies();
    fetchMentions();
    fetchPendingMentions();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/admin/x/posts');
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json();
      setPosts(data.posts.filter((p: Post) => 
        !p.inReplyToId && // Not a reply
        !('type' in p && p.type === 'MENTION') // Not a mention
      ));
    } catch (error) {
      toast.error('Failed to fetch posts');
    }
  };

  const fetchReplies = async () => {
    try {
      const response = await fetch('/api/admin/x/replies');
      if (!response.ok) throw new Error('Failed to fetch replies');
      const data = await response.json();
      setReplies(data.threads);
    } catch (error) {
      toast.error('Failed to fetch replies');
    }
  };

  const fetchMentions = async () => {
    try {
      const response = await fetch('/api/admin/x/mentions');
      if (!response.ok) throw new Error('Failed to fetch mentions');
      const data = await response.json();
      setMentions(data.mentions);
    } catch (error) {
      toast.error('Failed to fetch mentions');
    }
  };

  const fetchPendingMentions = async () => {
    try {
      const response = await fetch('/api/admin/x/mentions/pending');
      if (!response.ok) throw new Error('Failed to fetch pending mentions');
      const data = await response.json();
      setPendingMentions(data.mentions);
    } catch (error) {
      toast.error('Failed to fetch pending mentions');
    } finally {
      setLoading(false);
    }
  };

  const handlePostClick = async (post: Post) => {
    try {
      const response = await fetch(`/api/admin/x/posts/${post.id}/thread`);
      if (!response.ok) throw new Error('Failed to fetch thread');
      const data = await response.json();
      setSelectedThread(data.thread);
    } catch (error) {
      toast.error('Failed to fetch thread');
    }
  };

  const generateResponse = async (mention: PendingMentionWithResponse) => {
    try {
      setGeneratingResponses(prev => {
        const next = new Set(prev);
        next.add(mention.id);
        return next;
      });
      const response = await fetch(`/api/admin/x/mentions/${mention.id}/generate`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to generate response');
      const data = await response.json();
      
      // Update the pending mention with its generated response
      setPendingMentions(prev => prev.map(m => 
        m.id === mention.id 
          ? { 
              ...m, 
              generatedResponse: { 
                text: data.chat.messages[data.chat.messages.length - 1].content,
                chatId: data.chat.id 
              }
            }
          : m
      ));
    } catch (error) {
      toast.error('Failed to generate response');
    } finally {
      setGeneratingResponses(prev => {
        const next = new Set(prev);
        next.delete(mention.id);
        return next;
      });
    }
  };

  const generateAllResponses = async () => {
    try {
      setGeneratingAll(true);
      // Filter out mentions that already have responses
      const mentionsToGenerate = pendingMentions.filter(m => !m.generatedResponse);
      
      for (const mention of mentionsToGenerate) {
        await generateResponse(mention);
      }
      
      toast.success('Generated all responses');
    } catch (error) {
      toast.error('Failed to generate all responses');
    } finally {
      setGeneratingAll(false);
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
                setReplyToPost(post);
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

  const renderPendingMention = (mention: PendingMentionWithResponse) => (
    <div key={mention.id} className="space-y-4">
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-bold text-lg">{mention.authorName}</div>
              <div className="text-sm text-muted-foreground">@{mention.username}</div>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(mention.createdAt), { addSuffix: true })}
            </div>
          </div>
          <p className="mb-2">{mention.text}</p>
          <div className="flex gap-2">
            {!mention.generatedResponse ? (
              <Button 
                variant="default"
                onClick={() => generateResponse(mention)}
                disabled={generatingResponses.has(mention.id)}
              >
                {generatingResponses.has(mention.id) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Generate Response
              </Button>
            ) : (
              <Button 
                variant="outline"
                onClick={() => window.location.href = `/admin/responses/${mention.generatedResponse?.chatId}`}
              >
                Refine
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  await fetch(`/api/admin/x/mentions/${mention.id}/ignore`, { method: 'POST' });
                  await fetchPendingMentions();
                  toast.success('Mention marked as ignored');
                } catch (error) {
                  toast.error('Failed to ignore mention');
                }
              }}
            >
              Ignore
            </Button>
          </div>
        </CardContent>
      </Card>

      {mention.generatedResponse && (
        <div className="border-l-2 border-muted-foreground/20 ml-8 pl-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-lg">Amariel</div>
                  <div className="text-sm text-muted-foreground">@SentientAmariel</div>
                </div>
              </div>
              <p className="mb-4">{mention.generatedResponse.text}</p>
              <div className="flex gap-2">
                <Button 
                  variant="default"
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/admin/x/mentions/${mention.id}/post`, {
                        method: 'POST'
                      });
                      if (!response.ok) throw new Error('Failed to post response');
                      await fetchPendingMentions();
                      toast.success('Response posted successfully');
                    } catch (error) {
                      toast.error('Failed to post response');
                    }
                  }}
                >
                  Post to X
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = `/admin/responses/${mention.generatedResponse?.chatId}`}
                >
                  Refine
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div>Loading...</div>;
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
                onClick={() => setMentionModalOpen(true)}
              >
                Mock Mention
              </Button>
              {activeTab === 'pending' && (
                <Button
                  variant="default"
                  onClick={generateAllResponses}
                  disabled={generatingAll || pendingMentions.every(m => m.generatedResponse)}
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
                <div className="max-w-2xl mx-auto py-4 space-y-6">
                  {posts.map(renderPost)}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="replies" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="max-w-2xl mx-auto py-4 space-y-6">
                  {replies.map(renderThread)}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="mentions" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="max-w-2xl mx-auto py-4 space-y-6">
                  {mentions.map(renderPost)}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="pending" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="max-w-2xl mx-auto py-4 space-y-6">
                  {pendingMentions.map(renderPendingMention)}
                </div>
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
            fetchPosts();
            fetchReplies();
            fetchMentions();
          }}
          type="reply"
        />
      )}

      <TweetComposeModal
        open={mentionModalOpen}
        onClose={() => setMentionModalOpen(false)}
        onSuccess={() => {
          fetchPosts();
          fetchReplies();
          fetchMentions();
        }}
        type="mention"
      />
    </>
  );
} 