import { Loader2 } from "lucide-react"

export default function ConfiguracoesLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  )
}
