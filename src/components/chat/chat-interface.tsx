import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user' as const, content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      })

      if (!response.ok) throw new Error('Failed to send message')

      const data = await response.json()
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