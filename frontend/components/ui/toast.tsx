"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastProps = {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  onClose: (id: string) => void
}

export function Toast({ id, title, description, variant = "default", onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [id, onClose])

  const variantStyles = {
    default: "bg-background border-border text-foreground",
    destructive: "bg-destructive text-destructive-foreground border-destructive",
    success: "bg-green-600 text-white border-green-700"
  }

  return (
    <div className={cn(
      "animate-fade-in pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg",
      variantStyles[variant]
    )}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-1">
            {title && <div className="text-sm font-semibold">{title}</div>}
            {description && <div className="mt-1 text-sm opacity-90">{description}</div>}
          </div>
          <button
            onClick={() => onClose(id)}
            className="ml-4 inline-flex text-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ToastContainer({ toasts, onClose }: { toasts: ToastProps[], onClose: (id: string) => void }) {
  return (
    <div className="fixed top-0 right-0 z-50 flex flex-col gap-2 p-4 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  )
}

// Toast Hook
let toastCount = 0

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  const toast = React.useCallback((props: Omit<ToastProps, "id" | "onClose">) => {
    const id = `toast-${toastCount++}`
    setToasts((prev) => [...prev, { ...props, id, onClose: removeToast }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return {
    toasts,
    toast,
    removeToast,
    ToastContainer: () => <ToastContainer toasts={toasts} onClose={removeToast} />
  }
}
