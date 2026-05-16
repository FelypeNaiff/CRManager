export default function ConfiguracoesLoading() {
  return (
    <div className="space-y-6 max-w-5xl w-full pt-4">
      <div className="flex flex-col gap-3 mb-8">
        <div className="h-4 w-32 bg-slate-200 animate-pulse rounded"></div>
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded"></div>
        <div className="h-4 w-96 bg-slate-200 animate-pulse rounded"></div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-64 bg-white border shadow-sm animate-pulse rounded-xl"></div>
        <div className="h-64 bg-white border shadow-sm animate-pulse rounded-xl"></div>
      </div>
    </div>
  )
}
