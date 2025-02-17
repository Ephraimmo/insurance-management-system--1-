"use client"

import * as React from "react"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

interface ToasterToast extends Omit<ToastProps, 'title' | 'description'> {
  id: string
  title?: string
  description?: string
  action?: ToastActionElement
}

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type State = {
  toasts: ToasterToast[]
}

const toastState: State = {
  toasts: [],
}

export function useToast() {
  const [state, setState] = React.useState<State>(toastState)

  return {
    toasts: state.toasts,
    toast: (props: Omit<ToasterToast, "id">) => {
      const id = Math.random().toString(36).substr(2, 9)
      setState((prev) => ({
        toasts: [{ ...props, id }, ...prev.toasts].slice(0, TOAST_LIMIT),
      }))
      setTimeout(() => {
        setState((prev) => ({
          toasts: prev.toasts.filter((t) => t.id !== id),
        }))
      }, TOAST_REMOVE_DELAY)
      return id
    },
    dismiss: (toastId: string) => {
      setState((prev) => ({
        toasts: prev.toasts.filter((t) => t.id !== toastId),
      }))
    },
  }
} 