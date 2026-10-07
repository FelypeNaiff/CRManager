import React from "react"
import { LucideIcon } from "lucide-react"

export interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  colorClass?: string // Tailwind text/bg color for the icon container
}

export function ReportKpiCards({ cards }: { cards: KpiCardProps[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <div key={index} className="rounded-xl border bg-white p-6 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.colorClass || 'bg-slate-100 text-slate-600'}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">{card.title}</p>
                <h3 className="text-2xl font-bold font-headline text-slate-800">{card.value}</h3>
              </div>
            </div>
            {card.subtitle && (
              <p className="mt-3 text-xs text-slate-400">{card.subtitle}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
