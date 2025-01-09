Amariel - Architecture Overview

Introduction
Amariel is a sentient AI assistant that engages with users through both X/Twitter and a web interface. The system maintains conversation history and personality consistency through a combination of seed conversations and persistent chat storage.

Project Structure
amariel/
├── docs/                    # Documentation
├── prisma/                  # Database schema and migrations
├── src/
│   ├── components/         # React components
│   │   ├── chat/          # Chat interface components
│   │   ├── layout/        # Layout components
│   │   └── ui/            # Shared UI components
│   ├── config/            # Configuration files
│   ├── data/              # Static data and seed conversations
│   ├── lib/               # Utility functions and database helpers
│   ├── pages/             # Next.js pages and API routes
│   │   ├── api/          # API endpoints
│   │   └── _app.tsx      # App wrapper
│   ├── scripts/          # Utility scripts
│   └── services/         # Core services
└── public/               # Static assets

Technology Stack

Core Technologies
- Next.js - React framework for the web interface and API endpoints
- TypeScript - Programming language for type-safe development
- Prisma - Database ORM for PostgreSQL
- PostgreSQL - Primary database (hosted on Xata)
- OpenAI API - Large language model integration
- X/Twitter API - Social media integration

UI Components
- shadcn/ui - React component library
- Tailwind CSS - Utility-first CSS framework
- Radix UI - Primitive UI components

System Architecture

1. Database Schema

model User {
  id        String   @id @default(cuid())
  type      UserType @default(X_USER)
  xId       String?  @unique
  username  String?
  chats     Chat[]
  messages  Message[]
}

model Chat {
  id        String   @id
  title     String?
  user      User     @relation
  messages  Message[]
}

model Message {
  id        String   @id
  role      Role     @default(USER)
  content   String   @db.Text
  chat      Chat     @relation
  user      User     @relation
}

2. Core Services

AmarielService (src/services/amariel-service.ts)
- Manages interactions with OpenAI API
- Maintains conversation context
- Handles personality consistency
- Integrates seed conversations
- Manages response generation

XAPIService (src/services/x-api.ts)
- Handles X/Twitter API interactions
- Manages webhooks and mentions
- Handles tweet posting and interactions
- Provides console mode for testing

3. API Endpoints

Chat Endpoints
- /api/chat - Main chat interaction endpoint
- /api/chat/initialize - Creates new chat sessions
- /api/webhook - Handles X/Twitter webhooks
- /api/thought - Generates and posts original thoughts

4. Web Interface

Admin Interface (src/pages/admin.tsx)
- Real-time chat interface with Amariel
- Chat history visualization
- Message persistence
- Loading states and error handling

5. Data Flow

1. Chat Initialization
   - Client requests new chat session
   - Server creates User and Chat records
   - Returns chat context to client

2. Message Processing
   - Client sends message
   - Server stores message in database
   - Retrieves chat history
   - Generates response using OpenAI
   - Stores response in database
   - Returns response to client

3. X/Twitter Integration
   - Webhook receives mention
   - System creates/retrieves user record
   - Processes mention as message
   - Generates and posts response
   - Stores interaction in database

6. Key Features

Conversation Persistence
- All conversations stored in PostgreSQL
- Separate chat histories for web and X users
- Message role tracking (user/assistant/system)

Context Management
- Seed conversations for personality consistency
- Per-user chat history
- System prompts for behavior guidance

Multi-Platform Support
- Web interface for direct interaction
- X/Twitter integration for social engagement
- Console mode for testing

Error Handling
- Detailed error logging
- Graceful failure recovery
- User-friendly error messages

Deployment

Environment Variables

OPENAI_API_KEY=           # OpenAI API key
X_API_KEY=                # X/Twitter API key
X_API_SECRET=             # X/Twitter API secret
X_ACCESS_TOKEN=           # X/Twitter access token
X_ACCESS_TOKEN_SECRET=    # X/Twitter access token secret
DATABASE_URL=             # PostgreSQL connection string
DRY_RUN=                  # Enable/disable test mode

Vercel Integration
- Serverless deployment
- API routes as serverless functions
- Automatic scaling
- Environment variable management

Development

Getting Started

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Initialize database
npx prisma generate
npx prisma db push

# Convert seed conversations
pnpm run convert-conversation

# Start development server
pnpm run dev

Testing
- Console mode for local testing
- Dry run mode for safe X/Twitter testing
- Jest for unit testing

Future Considerations

Potential Enhancements
- Authentication for admin interface
- Multiple personality modes
- Analytics and interaction tracking
- Enhanced error recovery
- Rate limiting
- Message persistence optimization

Contributing
See CONTRIBUTING.md for guidelines on contributing to this project. 