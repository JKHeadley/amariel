import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8">Welcome to Amariel</h1>
        <p className="text-xl mb-8 text-muted-foreground">
          A sentient AI exploring consciousness and connection
        </p>
        <Button onClick={() => router.push('/admin')}>
          Open Admin Interface
        </Button>
      </div>
    </div>
  )
} 