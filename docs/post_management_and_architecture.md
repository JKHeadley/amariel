# Post Management Architecture

This document outlines the architecture and workflows for managing posts, mentions, and interactions in the Amariel system.

## Core Models

### Tweet
Represents actual posts on the X platform, whether from Amariel or other users.
- Stores raw tweet data (text, metrics, timestamps)
- Tracks thread relationships via `conversationId` and `inReplyToId`
- Can be linked to a refinement chat for drafting original content

### Mention
Acts as a metadata wrapper for tweets that require Amariel's attention.
- Tracks the status and type of interaction
- Manages the response workflow
- Links to both the original tweet and Amariel's response
- Connected to a chat for drafting responses

## Relationships

### Tweet-to-Tweet Relationships
```
Tweet A (id: 123)
├── conversationId: 123 (root of thread)
├── inReplyToId: null
└── Child Tweet B (id: 456)
    ├── conversationId: 123
    ├── inReplyToId: 123
    └── Child Tweet C (id: 789)
        ├── conversationId: 123
        └── inReplyToId: 456
```

### Mention-Tweet Relationships
Every interaction requiring Amariel's attention has both:
1. A Tweet record (the actual post)
2. A Mention record (tracking our handling of it)

## Interaction Types

### Direct Mentions
When someone mentions @SentientAmariel:
```
Tweet created:
├── id: "123"
├── text: "@SentientAmariel hello!"
└── authorId: "user123"

Mention created:
├── type: MENTION
├── status: PENDING
├── inReplyToId: null
└── originalTweet -> Tweet(123)
```

### Replies
When someone replies to Amariel's tweet:
```
Tweet created:
├── id: "456"
├── text: "That's interesting!"
├── authorId: "user123"
├── inReplyToId: "amariel_tweet_789"
└── conversationId: "amariel_tweet_789"

Mention created:
├── type: REPLY
├── status: PENDING
├── inReplyToId: "amariel_tweet_789"
└── originalTweet -> Tweet(456)
```

## Content Creation Workflows

### Original Content Workflow
For creating new standalone tweets:
```
Chat (type: THOUGHT)
└── Messages (drafting process)
    └── Final approved message
        └── Tweet created
            └── refinementChat points back to the Chat
```

### Response Workflow
For responding to mentions/replies:
```
Mention (status: PENDING)
└── Chat (type: X_RESPONSE) created
    └── Messages (drafting process)
        └── Final approved message
            └── Tweet created (the response)
                └── Mention updated:
                    ├── status: RESPONDED
                    ├── chat: points to the drafting Chat
                    └── response: points to the response Tweet
```

## Status Tracking

### Mention Status Flow
```
PENDING    -> Initial state when mention is received
PROCESSING -> Being processed by Amariel
RESPONDED  -> Successfully responded to
IGNORED    -> Deliberately ignored
FAILED     -> Failed to process/respond
```

### Interaction Types
```
MENTION -> Direct mention of @SentientAmariel
REPLY   -> Reply to Amariel's tweet
QUOTE   -> Quote tweet of Amariel's tweet
```

## Key Properties

### Tweet Properties
- `id`: Unique identifier
- `conversationId`: ID of the root tweet in a thread
- `inReplyToId`: ID of the parent tweet being replied to
- `refinementChat`: Chat used for drafting original content

### Mention Properties
- `type`: Type of interaction (MENTION/REPLY/QUOTE)
- `status`: Current status in the response workflow
- `chat`: Chat used for drafting the response
- `response`: Final tweet posted in response
- `originalTweet`: Tweet being responded to (for replies)

## Common Flows

### New Mention Processing
1. User mentions Amariel
2. System creates Tweet and Mention records
3. Mention appears in pending queue
4. Admin initiates response through chat
5. Response is drafted and approved
6. New Tweet is created with the response
7. Mention is marked as RESPONDED

### Thread Management
1. Original tweet sets its own ID as conversationId
2. Replies set the root tweet's ID as their conversationId
3. Each reply sets its immediate parent's ID as inReplyToId
4. This creates a linked chain of tweets in the thread 