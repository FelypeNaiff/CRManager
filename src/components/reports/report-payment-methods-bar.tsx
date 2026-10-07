import React from "react"

export interface PaymentMethodTotal {
  method: "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO" | "CARTEIRA" | "OUTROS"
  label: string
  amount: number
  colorClass: string
}

export function ReportPaymentMethodsBar({ totals }: { totals: PaymentMethodTotal[] }) {
  if (!totals || totals.length === 0) return null

  const grandTotal = totals.reduce((acc, curr) => acc + curr.amount, 0)
  
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 overflow-hidden">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Composição por Forma de Pagamento</h3>
      
      {/* Progress Bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden mb-4">
        {totals.map((t, idx) => {
          const percentage = grandTotal > 0 ? (t.amount / grandTotal) * 100 : 0
          return (
            <div 
              key={idx} 
              className={t.colorClass.replace('text-', 'bg-')} 
              style={{ width: `${percentage}%` }}
              title={`${t.label}: ${formatCurrency(t.amount)}`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs font-medium">
        {totals.map((t, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full ${t.colorClass.replace('text-', 'bg-')}`} />
            <span className="text-slate-600">{t.label}:</span>
            <span className="text-slate-900">{formatCurrency(t.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
