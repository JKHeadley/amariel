import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Message, Chat, User } from '@prisma/client'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)

  // Load or create chat on component mount
  useEffect(() => {
    async function initializeChat() {
      try {
        const response = await fetch('/api/chat/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) throw new Error('Failed to initialize chat')

        const { chat, messages } = await response.json()
        console.log('Initialized chat:', chat)
        console.log('Initial messages:', messages)
        
        setCurrentChat(chat)
        setMessages(messages.map((m: Message) => ({
          role: m.role.toLowerCase() as 'user' | 'assistant',
          content: m.content,
        })))
      } catch (error) {
        console.error('Error initializing chat:', error)
      }
    }

    initializeChat()
  }, [])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !currentChat) return

    const userMessage = { role: 'user' as const, content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      console.log('Sending message:', {
        message: input,
        chatId: currentChat.id,
      })

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          chatId: currentChat.id,
        }),
      })

      if (!response.ok) throw new Error('Failed to send message')

      const data = await response.json()
      console.log('Received response:', data)

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto p-4">
      <Card className="flex-1 mb-4 p-4">
        <ScrollArea className="h-full">
          {messages.map((message, i) => (
            <div
              key={i}
              className={`mb-4 p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary/10 ml-auto max-w-[80%]'
                  : 'bg-secondary/10 mr-auto max-w-[80%]'
              }`}
            >
              <p className="text-sm font-medium mb-1">
                {message.role === 'user' ? 'You' : 'Amariel'}
              </p>
              <p className="text-sm">{message.content}</p>
            </div>
          ))}
          {isLoading && (
            <div className="text-center text-muted-foreground">
              Amariel is thinking...
            </div>
          )}
        </ScrollArea>
      </Card>

      <form onSubmit={sendMessage} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading}>
          Send
        </Button>
      </form>
    </div>
  )
} 