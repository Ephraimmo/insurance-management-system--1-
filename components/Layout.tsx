import type { ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"

interface LayoutProps {
  children: ReactNode
  setCurrentPage: (page: string) => void
  onLogout: () => void
  userRole?: string
}

export function Layout({ children, setCurrentPage, onLogout, userRole }: LayoutProps) {
  return (
    <div className="min-h-screen flex">
      <Sidebar setCurrentPage={setCurrentPage} userRole={userRole} />
      <div className="flex-1">
        <Header onLogout={onLogout} />
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

