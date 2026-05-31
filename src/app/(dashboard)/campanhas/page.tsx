"use client"
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Megaphone } from "lucide-react"

export default function CampanhasPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="h-8 w-8 text-primary" /> Campanhas
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Módulo em Manutenção</CardTitle>
        </CardHeader>
        <CardContent>
          <p>O módulo de Campanhas está sendo migrado para o banco de dados principal. Por favor, aguarde.</p>
        </CardContent>
      </Card>
    </div>
  )
}
