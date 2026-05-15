"use client"

import React from "react"
import Link from "next/link"
import { Search, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

// 1. ConfigBreadcrumb
export function ConfigBreadcrumb({ items }: { items: { label: string, href?: string }[] }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span>/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:underline hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// 2. ConfigPageHeader
export function ConfigPageHeader({ title, description, breadcrumb }: { title: string, description: string, breadcrumb?: { label: string, href?: string }[] }) {
  return (
    <div className="mb-6">
      {breadcrumb && <ConfigBreadcrumb items={breadcrumb} />}
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="text-muted-foreground mt-1">{description}</p>
    </div>
  )
}

// 3. ConfigCardSection
export function ConfigCardSection({ title, description, icon: Icon, children, footer, className }: { title: string, description?: string, icon?: React.ElementType, children: React.ReactNode, footer?: React.ReactNode, className?: string }) {
  return (
    <Card className={cn("rounded-xl border shadow-sm bg-white overflow-hidden", className)}>
      <CardHeader className="bg-slate-50/50 border-b pb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          <CardTitle className="text-lg font-semibold text-slate-800">{title}</CardTitle>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-6">
        {children}
      </CardContent>
      {footer && (
        <CardFooter className="bg-slate-50/50 border-t p-4 flex justify-end">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}

// 4. ConfigFormActions
export function ConfigFormActions({ onCancel, onSave, isSaving, saveLabel = "Atualizar", cancelLabel = "Cancelar" }: { onCancel?: () => void, onSave?: () => void, isSaving?: boolean, saveLabel?: string, cancelLabel?: string }) {
  return (
    <div className="flex items-center justify-end gap-3 w-full">
      {onCancel && (
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSaving}>
          {cancelLabel}
        </Button>
      )}
      {onSave && (
        <Button type="submit" onClick={onSave} disabled={isSaving} className="bg-primary text-primary-foreground">
          {isSaving ? "Salvando..." : saveLabel}
        </Button>
      )}
    </div>
  )
}

// 5. ConfigInputField
export function ConfigInputField({ label, id, description, ...props }: React.ComponentProps<typeof Input> & { label: string, description?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</Label>
      <Input id={id} className="bg-white" {...props} />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

// 6. ConfigTextareaField
export function ConfigTextareaField({ label, id, description, ...props }: React.ComponentProps<typeof Textarea> & { label: string, description?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</Label>
      <Textarea id={id} className="bg-white min-h-[100px]" {...props} />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

// 7. ConfigSelectField
export function ConfigSelectField({ label, id, description, options, value, onValueChange, placeholder }: { label: string, id?: string, description?: string, options: { label: string, value: string }[], value?: string, onValueChange?: (value: string) => void, placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="bg-white">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

// 8. ConfigSwitchField
export function ConfigSwitchField({ label, id, description, checked, onCheckedChange }: { label: string, id?: string, description?: string, checked?: boolean, onCheckedChange?: (checked: boolean) => void }) {
  return (
    <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-white shadow-sm transition-colors hover:bg-slate-50/50">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium text-slate-800">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

// 9. ConfigSearchBar
export function ConfigSearchBar({ placeholder = "Buscar...", value, onChange }: { placeholder?: string, value?: string, onChange?: (val: string) => void }) {
  return (
    <div className="relative max-w-md w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input 
        className="pl-9 bg-white" 
        placeholder={placeholder} 
        value={value} 
        onChange={(e) => onChange?.(e.target.value)} 
      />
    </div>
  )
}

// 10. ConfigStatusBadge
export function ConfigStatusBadge({ status }: { status: "ativo" | "inativo" | "pendente" | "erro" | "sucesso" | string }) {
  const s = status.toLowerCase()
  if (s === "ativo" || s === "sucesso" || s === "valido" || s === "producao") {
    return <Badge className="bg-emerald-500 hover:bg-emerald-600 font-medium">{status.toUpperCase()}</Badge>
  }
  if (s === "inativo" || s === "bloqueado" || s === "erro" || s === "revogado") {
    return <Badge variant="destructive" className="font-medium">{status.toUpperCase()}</Badge>
  }
  if (s === "pendente" || s === "expirado" || s === "homologacao") {
    return <Badge className="bg-orange-500 hover:bg-orange-600 font-medium text-white">{status.toUpperCase()}</Badge>
  }
  return <Badge variant="outline" className="font-medium text-slate-600">{status.toUpperCase()}</Badge>
}

// 11. ConfigEmptyState
export function ConfigEmptyState({ title, description, icon: Icon, action }: { title: string, description: string, icon?: React.ElementType, action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed bg-slate-50/50">
      {Icon && (
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

// 12. ConfigConfirmDialog
export function ConfigConfirmDialog({ open, onOpenChange, title, description, onConfirm, isDestructive = false, isSaving = false }: { open: boolean, onOpenChange: (open: boolean) => void, title: string, description: string, onConfirm: () => void, isDestructive?: boolean, isSaving?: boolean }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isDestructive && <AlertTriangle className="h-5 w-5 text-destructive" />}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }} 
            disabled={isSaving}
            className={isDestructive ? "bg-destructive hover:bg-destructive/90 text-white" : ""}
          >
            {isSaving ? "Aguarde..." : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 13. ConfigTabs (Re-exports for convenience)
export { Tabs as ConfigTabs, TabsList as ConfigTabsList, TabsTrigger as ConfigTabsTrigger, TabsContent as ConfigTabsContent }

// 14. ConfigDataTable (Re-exports for convenience)
export { Table as ConfigDataTable, TableHeader as ConfigDataTableHeader, TableBody as ConfigDataTableBody, TableRow as ConfigDataTableRow, TableHead as ConfigDataTableHead, TableCell as ConfigDataTableCell }
