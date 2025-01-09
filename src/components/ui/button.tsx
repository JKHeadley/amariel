import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-pink-500/20 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90",
        gradient: "bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:opacity-90 shadow-md hover:shadow-lg",
        outline: "border-2 border-gray-200 bg-white hover:bg-gray-50/80",
        ghost: "text-gray-600 hover:bg-gray-100/50",
      },
      size: {
        default: "h-12 px-6 py-3 text-base",
        sm: "h-9 rounded-md px-3",
        lg: "h-14 rounded-md px-8 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants } 