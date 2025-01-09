import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SignInCardProps {
  email: string;
  isLoading: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSignIn: () => void;
}

export function SignInCard({ 
  email, 
  isLoading, 
  onEmailChange, 
  onSubmit,
  onGoogleSignIn 
}: SignInCardProps) {
  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="relative">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="pr-12"
          />
          <Button 
            size="sm"
            variant="ghost"
            className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-primary"
            type="submit"
            disabled={isLoading}
          >
            <Mail className="h-4 w-4" />
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
          variant="gradient"
        >
          {isLoading && (
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
          )}
          Explore Consciousness
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={onGoogleSignIn}
        disabled={isLoading}
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"
          />
        </svg>
        Sign in with Google
      </Button>
    </div>
  );
} 