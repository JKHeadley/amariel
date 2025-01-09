import { ChatInterface } from '@/components/chat/chat-interface'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Chat with Amariel
        </h1>
        <ChatInterface />
      </div>
    </div>
  )
} 