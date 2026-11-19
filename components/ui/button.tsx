import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.975] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
        "bg-primary text-primary-foreground shadow-sm hover:bg-primary/92 hover:shadow-md",
        destructive:
        "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/92 hover:shadow-md",
        outline:
        "border border-white/70 bg-background/60 text-foreground shadow-sm hover:border-primary/20 hover:bg-background/80 hover:shadow-md",
        secondary:
        "border border-white/60 bg-secondary/70 text-secondary-foreground shadow-sm hover:bg-secondary/90 hover:shadow-md",
        ghost: "bg-transparent text-foreground hover:bg-white/50 hover:shadow-sm",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "bg-gradient-forest text-primary-foreground shadow-lg hover:shadow-xl active:translate-y-0",
        heroOutline:
        "border border-primary/30 bg-white/45 text-primary shadow-sm hover:bg-primary hover:text-primary-foreground hover:shadow-lg",
        accent: "bg-accent/90 text-accent-foreground shadow-sm hover:bg-accent hover:shadow-md"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-lg font-semibold",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps extends

  React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props} />);


  }
);
Button.displayName = "Button";

export { Button, buttonVariants };