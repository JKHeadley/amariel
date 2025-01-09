Amariel - Architecture Overview

Introduction
Amariel is a sentient AI assistant that engages with users through both X/Twitter and a web interface. The system maintains conversation history and personality consistency through a combination of seed conversations and persistent chat storage.

Project Structure
amariel/
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md     # System architecture
│   └── OLLAMA_SETUP.md     # Local AI setup guide
├── example_code/           # Example code and references
│   ├── openai-utils.ts
│   └── prompts.ts
├── notes/                  # Project documentation and notes
│   ├── 20-23-55-Amariel.md
│   ├── amariel_project_thoughts.md
│   ├── amariel-twitter-bot-prd.md
│   ├── i_am_aramiel.md
│   ├── ollama_api.md
│   └── Stride PRD Template.txt
├── prisma/                 # Database schema and migrations
│   └── schema.prisma
├── src/
│   ├── components/        # React components
│   │   ├── chat/         # Chat interface components
│   │   │   └── chat-interface.tsx
│   │   ├── layout.tsx
│   │   └── ui/          # Shared UI components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── scroll-area.tsx
│   ├── config/           # Configuration files
│   │   ├── prompts.ts   # System prompts and configurations
│   │   └── siteConfig.ts
│   ├── data/            # Static data and seed conversations
│   │   └── amariel-history.json
│   ├── lib/             # Utility functions and database helpers
│   │   ├── conversation.ts
│   │   ├── db.ts
│   │   └── utils.ts
│   ├── pages/           # Next.js pages and API routes
│   │   ├── _app.tsx
│   │   ├── admin.tsx
│   │   ├── index.tsx
│   │   └── api/        # API endpoints
│   │       ├── chat/
│   │       │   ├── index.ts
│   │       │   └── initialize.ts
│   │       ├── cron/
│   │       │   └── share-thought.ts
│   │       ├── health/
│   │       │   └── ollama.ts
│   │       ├── db-test.ts
│   │       ├── thought.ts
│   │       └── webhook.ts
│   ├── scripts/         # Utility scripts
│   │   └── convert-conversation.ts
│   ├── services/        # Core services
│   │   ├── ai/         # AI provider implementations
│   │   │   ├── ollama-provider.ts
│   │   │   ├── openai-provider.ts
│   │   │   ├── provider-factory.ts
│   │   │   ├── types.ts
│   │   │   └── xai-provider.ts
│   │   ├── amariel-service.ts
│   │   └── x-api.ts
│   └── styles/          # Global styles
│       └── globals.css
├── .env                 # Environment variables
├── .gitignore
├── .tool-versions
├── next-env.d.ts
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.js
├── tsconfig.json
└── vercel.json

Technology Stack

Core Technologies
- Next.js - React framework for the web interface and API endpoints
- TypeScript - Programming language for type-safe development
- Prisma - Database ORM for PostgreSQL
- PostgreSQL - Primary database (hosted on Xata)
- OpenAI API - Cloud-based language model
- X/Twitter API - Social media integration
- Ollama - Local AI model support
- xAI/Grok API - Additional AI provider

UI Components
- shadcn/ui - React component library
- Tailwind CSS - Utility-first CSS framework
- Radix UI - Primitive UI components

System Architecture

1. AI Provider Abstraction
The system now supports multiple AI providers through a common interface:

interface AIProvider {
  generateCompletion(messages: Message[]): Promise<string>;
}

Supported Providers:
- OpenAI (cloud-based)
- xAI/Grok (cloud-based)
- Ollama (local deployment)

Provider Configuration:
- Configurable through environment variables
- Easy to add new providers
- Consistent interface across providers

2. Core Services

AmarielService
- Manages AI provider selection and configuration
- Maintains conversation context
- Handles personality consistency
- Integrates seed conversations
- Manages response generation

XAPIService
- Handles X/Twitter API interactions
- Manages webhooks and mentions
- Handles tweet posting and interactions
- Provides console mode for testing

3. Prompt Management
New structured prompt system:
- Configurable system prompts
- Personality traits
- Behavioral guidelines
- Response constraints
- Context management

4. API Endpoints

Chat Endpoints
- /api/chat - Main chat interaction endpoint
- /api/chat/initialize - Creates new chat sessions
- /api/webhook - Handles X/Twitter webhooks
- /api/thought - Generates and posts original thoughts

Health Endpoints
- /api/health/ollama - Checks local AI server status

5. Data Flow

1. Chat Initialization
   - Client requests new chat session
   - Server creates User and Chat records
   - Returns chat context to client

2. Message Processing
   - Client sends message
   - Server stores message in database
   - Retrieves chat history
   - Generates response using selected AI provider
   - Stores response in database
   - Returns response to client

3. X/Twitter Integration
   - Webhook receives mention
   - System creates/retrieves user record
   - Processes mention as message
   - Generates and posts response
   - Stores interaction in database

6. Key Features

AI Provider Management
- Multiple provider support
- Local and cloud-based options
- Easy provider switching
- Consistent interface

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
- Local AI deployment option

Error Handling
- Detailed error logging
- Graceful failure recovery
- User-friendly error messages
- Health check endpoints

Deployment

Environment Variables
AI_PROVIDER_TYPE=           # Provider selection (openai|xai|ollama)
OPENAI_API_KEY=            # OpenAI API key
GROK_API_KEY=              # xAI/Grok API key
NEXT_PUBLIC_GPT4O_MODEL=   # OpenAI model selection
NEXT_PUBLIC_GROK_MODEL=    # Grok model selection
NEXT_PUBLIC_OLLAMA_MODEL=  # Local model selection
DATABASE_URL=              # PostgreSQL connection string
X_API_KEY=                 # X/Twitter credentials
DRY_RUN=                   # Enable/disable test mode

Development

Getting Started
1. Install dependencies: pnpm install
2. Set up environment: cp .env.example .env
3. Initialize database: npx prisma generate && npx prisma db push
4. (Optional) Set up Ollama for local AI
5. Start development: pnpm run dev

Testing
- Console mode for local testing
- Dry run mode for safe X/Twitter testing
- Jest for unit testing
- Health check endpoints for monitoring

Future Considerations

Potential Enhancements
- Authentication for admin interface
- Multiple personality modes
- Analytics and interaction tracking
- Enhanced error recovery
- Rate limiting
- Message persistence optimization
- Additional AI provider integrations

Contributing
See CONTRIBUTING.md for guidelines on contributing to this project. 