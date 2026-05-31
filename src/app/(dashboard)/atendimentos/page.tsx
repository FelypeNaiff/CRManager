"use client"
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Headset } from "lucide-react"

export default function AtendimentosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center gap-2">
          <Headset className="h-8 w-8 text-primary" /> Atendimentos
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Módulo em Manutenção</CardTitle>
        </CardHeader>
        <CardContent>
          <p>O módulo de Atendimentos está sendo migrado para o novo sistema. Por favor, aguarde a conclusão da fase de desenvolvimento.</p>
        </CardContent>
      </Card>
    </div>
  )
}
