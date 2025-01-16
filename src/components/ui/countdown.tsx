import { Clock } from 'lucide-react';

interface CountdownProps {
  timeLeft: string;
}

export function Countdown({ timeLeft }: CountdownProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>Rate limit resets in: {timeLeft}</span>
    </div>
  );
} 