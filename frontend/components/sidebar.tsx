"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Folder, Database, Settings, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function Sidebar() {
  const pathname = usePathname()

  const routes = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/",
      color: "text-sky-500",
    },
    {
      label: "Projects",
      icon: Folder,
      href: "/projects",
      color: "text-violet-500",
    },
    {
      label: "Universe",
      icon: Database,
      href: "/universe",
      color: "text-pink-700",
    },
    {
      label: "Settings",
      icon: Settings,
      href: "/settings",
    },
  ]

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white w-64 border-r border-gray-800">
      <div className="px-3 py-2 flex-1">
        <Link href="/" className="flex items-center pl-3 mb-14">
          <div className="relative w-8 h-8 mr-4">
            {/* Logo placeholder */}
            <div className="absolute bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg w-full h-full flex items-center justify-center font-bold text-lg">
              V
            </div>
          </div>
          <h1 className="text-2xl font-bold">VisionLab</h1>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                pathname === route.href ? "text-white bg-white/10" : "text-zinc-400"
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="px-3 py-2">
         <Link
            href="/account"
            className={cn(
              "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition text-zinc-400"
            )}
          >
            <div className="flex items-center flex-1">
              <User className="h-5 w-5 mr-3 text-gray-400" />
              Account
            </div>
          </Link>
      </div>
    </div>
  )
}
