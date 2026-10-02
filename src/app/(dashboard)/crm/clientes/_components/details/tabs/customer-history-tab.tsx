"use client"

import React from "react"
import { CheckCircle } from "lucide-react"

interface CustomerHistoryTabProps {
  historyLogs: any[]
}

export function CustomerHistoryTab({ historyLogs }: CustomerHistoryTabProps) {
  return (
    <div className="space-y-4 pt-4 text-xs">
      <h3 className="font-bold text-slate-800 text-sm">Histórico de Auditoria do Cliente</h3>
      {historyLogs.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-slate-50/40 text-muted-foreground">
          Sem registros de histórico.
        </div>
      ) : (
        <div className="border rounded-xl divide-y bg-white">
          {historyLogs.map((log) => (
            <div key={log.id} className="p-3 flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <CheckCircle className="h-3.5 w-3.5 text-indigo-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800">{log.tipo_acao}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{log.descricao}</p>
              </div>
              <span className="text-[9px] text-slate-400 shrink-0 self-start">
                {log.created_at ? new Date(log.created_at.seconds * 1000).toLocaleString("pt-BR") : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
