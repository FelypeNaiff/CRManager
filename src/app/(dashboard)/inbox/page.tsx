"use client"

import { Card, CardContent } from "@/components/ui/card"
import { MessageSquare, Clock } from "lucide-react"

export default function InboxPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pt-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
          <MessageSquare className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800">
            Comunicação / Inbox
          </h1>
          <p className="text-muted-foreground text-sm">
            Central de mensagens e contatos integrados.
          </p>
        </div>
      </div>

      <Card className="border-indigo-100 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 bg-indigo-50/50 rounded-full text-indigo-500">
            <Clock className="h-12 w-12 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Módulo em Desenvolvimento</h2>
          <p className="text-muted-foreground max-w-sm">
            Estamos integrando os canais de atendimento e WhatsApp. Em breve você poderá centralizar a comunicação aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
