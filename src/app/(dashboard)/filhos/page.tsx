"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function FilhosRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/crm/filhos")
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-600 mb-2"></div>
      <p className="text-muted-foreground text-sm">Redirecionando para CRM Filhos...</p>
    </div>
  )
}
