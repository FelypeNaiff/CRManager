export function FinancialBackendGap({ title, description }: { title: string; description: string }) {
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">Funcionalidade indisponível no backend oficial.</p></div><div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><p className="font-semibold">Nenhuma operação simulada será executada.</p><p className="mt-2">{description}</p></div></div>;
}
