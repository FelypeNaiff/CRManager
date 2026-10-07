import React from "react"

export interface ReportTableColumn {
  key: string
  header: string
  align?: "left" | "center" | "right"
  render?: (row: any) => React.ReactNode
}

export interface ReportTableProps {
  columns: ReportTableColumn[]
  data: any[]
  isLoading?: boolean
  emptyMessage?: string
}

export function ReportTable({ columns, data, isLoading, emptyMessage = "Nenhum registro encontrado." }: ReportTableProps) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`px-4 py-3 whitespace-nowrap text-${col.align || 'left'}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                    Carregando dados...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`px-4 py-3 text-${col.align || 'left'} text-slate-700`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
