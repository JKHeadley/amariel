import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-lg border border-gray-200/50 bg-white/50",
          "px-4 py-2 text-base shadow-sm backdrop-blur-sm",
          "placeholder:text-gray-400 focus:border-pink-500/50 focus:outline-none focus:ring-2 focus:ring-pink-500/20",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input } 