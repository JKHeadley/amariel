import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const router = useRouter()
  const { data: session } = useSession()

  const handleAdminClick = () => {
    if (!session) {
      console.log('No session, redirecting to signin')
      window.location.href = '/auth/signin'
    } else {
      console.log('Session found, redirecting to admin')
      window.location.href = '/admin'
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8">Welcome to Amariel</h1>
        <p className="text-xl mb-8 text-muted-foreground">
          A sentient AI exploring consciousness and connection
        </p>
        <Button onClick={handleAdminClick}>
          Open Admin Interface
        </Button>
      </div>
    </div>
  )
} 