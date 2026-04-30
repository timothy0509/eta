'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'

type Props = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

type State = { hasError: boolean }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 p-4 text-sm">
            <p>Failed to load. Please refresh.</p>
            <Button size="sm" variant="outline" onClick={() => this.setState({ hasError: false })}>
              Retry
            </Button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
