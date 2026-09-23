"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

// Context shared between SmartSelect, SelectTrigger, SelectContent, SelectItem
const MobileSelectContext = React.createContext(null)

// Smart root: decides mobile vs desktop ONCE and shares via context
function SmartSelect({ children, value, onValueChange, defaultValue, ...props }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? value ?? "")

  React.useEffect(() => {
    if (value !== undefined) setInternalValue(value)
  }, [value])

  const currentValue = value !== undefined ? value : internalValue

  const labelMap = React.useMemo(() => {
    const map = {}
    const collect = (nodes) => {
      React.Children.forEach(nodes, child => {
        if (!child) return
        if (child.type === SelectItem) {
          map[child.props.value] = child.props.children
        } else if (child.props?.children) {
          collect(child.props.children)
        }
      })
    }
    collect(children)
    return map
  }, [children])

  const handleChange = (v) => {
    setInternalValue(v)
    onValueChange?.(v)
    setOpen(false)
  }

  if (isMobile) {
    return (
      <MobileSelectContext.Provider value={{ open, setOpen, currentValue, handleChange, labelMap }}>
        {children}
      </MobileSelectContext.Provider>
    )
  }

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} defaultValue={defaultValue} {...props}>
      {children}
    </SelectPrimitive.Root>
  )
}

const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const mobileCtx = React.useContext(MobileSelectContext)

  if (mobileCtx) {
    const displayLabel = mobileCtx.currentValue
      ? (mobileCtx.labelMap?.[mobileCtx.currentValue] ?? mobileCtx.currentValue)
      : null

    let placeholder = "Selecionar"
    React.Children.forEach(children, child => {
      if (child?.props?.placeholder) placeholder = child.props.placeholder
    })

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => mobileCtx.setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !displayLabel && "text-muted-foreground",
          className
        )}
        {...props}
      >
        <span className="line-clamp-1">{displayLabel || placeholder}</span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>
    )
  }

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      {...props}>
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => {
  const mobileCtx = React.useContext(MobileSelectContext)

  // Mobile: render as a drawer
  if (mobileCtx) {
    const items = []
    const collect = (nodes) => {
      React.Children.forEach(nodes, child => {
        if (!child) return
        if (child.type === SelectItem) items.push(child)
        else if (child.props?.children) collect(child.props.children)
      })
    }
    collect(children)

    return (
      <Drawer open={mobileCtx.open} onOpenChange={mobileCtx.setOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle className="sr-only">Selecionar</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto pb-6 px-2">
            {items.map((item, i) => {
              const val = item.props.value
              const isSelected = val === mobileCtx.currentValue
              return (
                <button
                  key={val ?? i}
                  onClick={() => mobileCtx.handleChange(val)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm transition-colors",
                    isSelected ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                  )}
                >
                  <span>{item.props.children}</span>
                  {isSelected && <Check className="w-4 h-4" />}
                </button>
              )
            })}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // Desktop: standard Radix popover
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}>
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}>
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})
SelectContent.displayName = "SelectContent"

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props} />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => {
  const mobileCtx = React.useContext(MobileSelectContext)
  // On mobile, items are collected by SelectContent — skip direct rendering
  if (mobileCtx) return null

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}>
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
})
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props} />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  SmartSelect as Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}