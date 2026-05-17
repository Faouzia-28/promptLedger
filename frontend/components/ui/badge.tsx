import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border border-zinc-700 bg-zinc-800 text-zinc-100 [a]:hover:bg-zinc-700",
        secondary:
          "border border-zinc-700 bg-zinc-800 text-zinc-100 [a]:hover:bg-zinc-700",
        destructive:
          "border border-red-400/20 bg-red-400/10 text-red-400 focus-visible:ring-red-400/20 [a]:hover:bg-red-400/15",
        outline:
          "border border-zinc-700 text-zinc-100 [a]:hover:bg-zinc-800 [a]:hover:text-zinc-100",
        ghost:
          "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
        link: "text-zinc-100 underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
