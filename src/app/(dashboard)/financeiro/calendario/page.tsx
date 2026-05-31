"use client"

import { useState, useMemo } from "react"
import { useCollection, useMemoFirebase, useFirestore } from "@/supabase-mocks"
import { collection } from "@/supabase-mocks/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  ArrowDownCircle, ArrowUpCircle, AlertCircle, CheckCircle2, Clock 
} from "lucide-react"
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO,
  isBefore, startOfDay
} from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function CalendarioFinanceiroPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  
  // Filters
  const [filterType, setFilterType] = useState<'ALL' | 'PAYABLE' | 'RECEIVABLE'>('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'PAID' | 'OVERDUE'>('ALL')

  const db = useFirestore()

  // Queries
  const payablesQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "accounts_payable")
  }, [db])
  
  const receivablesQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "accounts_receivable")
  }, [db])

  // Fetching
  const { data: payables } = useCollection(payablesQuery)
  const { data: receivables } = useCollection(receivablesQuery)

  // Merge and format events
  const allEvents = useMemo(() => {
    const events: any[] = []
    
    if (payables) {
      payables.forEach((p: any) => {
        events.push({
          ...p,
          eventType: 'PAYABLE',
          personName: p.supplierName,
        })
      })
    }
    
    if (receivables) {
      receivables.forEach((r: any) => {
        events.push({
          ...r,
          eventType: 'RECEIVABLE',
          personName: r.clientName,
        })
      })
    }
    
    return events
  }, [payables, receivables])

  // Apply Filters
  const filteredEvents = useMemo(() => {
    const today = startOfDay(new Date())
    
    return allEvents.filter(event => {
      // Filter Type
      if (filterType !== 'ALL' && event.eventType !== filterType) return false
      
      // Filter Status
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'PAID' && event.status !== 'PAID') return false
        if (filterStatus === 'PENDING' && event.status !== 'PENDING') return false
        
        if (filterStatus === 'OVERDUE') {
          const eventDate = parseISO(event.dueDate)
          const isOverdue = event.status === 'PENDING' && isBefore(startOfDay(eventDate), today)
          if (!isOverdue) return false
        }
      }
      
      // se vencido foi filtrado de outra forma, certificar que pendente não mostra vencido se não quisermos?
      // O usuário pode querer ver apenas pendentes no prazo, mas por padrão "Pendente" abrange vencido também, a menos que separado.
      // Vamos manter simples: PENDING traz tudo não pago. OVERDUE traz só os não pagos e vencidos.

      return true
    })
  }, [allEvents, filterType, filterStatus])

  // Calendar Days Calculation
  const daysInCalendar = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth))
    const end = endOfWeek(endOfMonth(currentMonth))
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  // Handlers
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const handleCurrentMonth = () => {
    setCurrentMonth(new Date())
    setSelectedDate(new Date())
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

  // Componente de Badges e Estilos
  const getEventStyle = (event: any) => {
    const today = startOfDay(new Date())
    const eventDate = startOfDay(parseISO(event.dueDate))
    const isOverdue = event.status === 'PENDING' && isBefore(eventDate, today)

    if (isOverdue) return "bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20"
    if (event.status === 'PAID') return "bg-muted text-muted-foreground border-transparent opacity-70"
    
    if (event.eventType === 'RECEIVABLE') return "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
    if (event.eventType === 'PAYABLE') return "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
    
    return ""
  }

  const getEventIcon = (event: any) => {
    const today = startOfDay(new Date())
    const eventDate = startOfDay(parseISO(event.dueDate))
    const isOverdue = event.status === 'PENDING' && isBefore(eventDate, today)

    if (isOverdue) return <AlertCircle className="h-3 w-3 mr-1" />
    if (event.status === 'PAID') return <CheckCircle2 className="h-3 w-3 mr-1" />
    if (event.eventType === 'RECEIVABLE') return <ArrowUpCircle className="h-3 w-3 mr-1" />
    if (event.eventType === 'PAYABLE') return <ArrowDownCircle className="h-3 w-3 mr-1" />
    return null
  }

  // Eventos do dia selecionado
  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter(e => isSameDay(parseISO(e.dueDate), selectedDate))
  }, [filteredEvents, selectedDate])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Calendário Financeiro</h1>
          <p className="text-muted-foreground">Visualize seus recebimentos e pagamentos de forma cronológica.</p>
        </div>
      </div>

      {/* Toolbar & Filtros */}
      <Card className="p-4 border shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="flex items-center justify-center w-40 font-bold text-lg capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </div>
            <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="secondary" size="sm" className="ml-2" onClick={handleCurrentMonth}>Hoje</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-muted p-1 rounded-md">
              <Button variant={filterType === 'ALL' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterType('ALL')} className="text-xs h-7">Todos</Button>
              <Button variant={filterType === 'RECEIVABLE' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterType('RECEIVABLE')} className="text-xs h-7">A Receber</Button>
              <Button variant={filterType === 'PAYABLE' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterType('PAYABLE')} className="text-xs h-7">A Pagar</Button>
            </div>
            
            <div className="flex bg-muted p-1 rounded-md">
              <Button variant={filterStatus === 'ALL' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterStatus('ALL')} className="text-xs h-7">Todos</Button>
              <Button variant={filterStatus === 'PENDING' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterStatus('PENDING')} className="text-xs h-7 text-blue-600">Pendentes</Button>
              <Button variant={filterStatus === 'OVERDUE' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterStatus('OVERDUE')} className="text-xs h-7 text-destructive">Vencidos</Button>
              <Button variant={filterStatus === 'PAID' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterStatus('PAID')} className="text-xs h-7 text-emerald-600">Pagos</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid do Calendário */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-2 text-center text-sm font-semibold text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)]">
          {daysInCalendar.map((date, i) => {
            const isCurrentMonth = isSameMonth(date, currentMonth)
            const isSelected = isSameDay(date, selectedDate)
            const isTodayDate = isSameDay(date, new Date())
            
            // Puxa eventos deste dia
            const dayEvents = filteredEvents.filter(e => isSameDay(parseISO(e.dueDate), date))

            return (
              <div 
                key={i} 
                onClick={() => setSelectedDate(date)}
                className={`
                  border-r border-b p-2 transition-colors cursor-pointer flex flex-col gap-1
                  ${isCurrentMonth ? 'bg-background' : 'bg-muted/10'}
                  ${isSelected ? 'ring-2 ring-inset ring-primary bg-primary/5' : 'hover:bg-muted/50'}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isTodayDate ? 'bg-primary text-primary-foreground' : (isCurrentMonth ? '' : 'text-muted-foreground')}`}>
                    {format(date, "d")}
                  </span>
                  {dayEvents.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">{dayEvents.length}</Badge>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-1 mt-1 hide-scrollbar">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div 
                      key={event.id} 
                      className={`text-[10px] p-1 px-1.5 rounded-sm border truncate flex items-center ${getEventStyle(event)}`}
                      title={`${event.description} - ${formatCurrency(event.amount)}`}
                    >
                      {getEventIcon(event)}
                      <span className="truncate flex-1">{event.description}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground text-center font-medium mt-1">
                      +{dayEvents.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Lista Inferior (Detalhes do Dia) */}
      <Card>
        <CardHeader className="py-4 border-b bg-muted/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" /> 
            Lançamentos de {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {selectedDayEvents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum lançamento encontrado para esta data.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Pessoa (Fornecedor/Cliente)</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedDayEvents.map(event => (
                  <TableRow key={event.id} className={event.status === 'PAID' ? 'opacity-70 bg-muted/30' : ''}>
                    <TableCell>
                      {event.eventType === 'RECEIVABLE' 
                        ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none"><ArrowUpCircle className="w-3 h-3 mr-1"/> Receita</Badge>
                        : <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-none"><ArrowDownCircle className="w-3 h-3 mr-1"/> Despesa</Badge>
                      }
                    </TableCell>
                    <TableCell className="font-medium">{event.description}</TableCell>
                    <TableCell className="text-muted-foreground">{event.personName || "-"}</TableCell>
                    <TableCell className={`text-right font-bold ${event.eventType === 'RECEIVABLE' ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {formatCurrency(event.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {event.status === 'PAID' ? (
                        <span className="flex items-center justify-center text-xs font-medium text-emerald-600"><CheckCircle2 className="w-3 h-3 mr-1"/> Pago</span>
                      ) : (
                        isBefore(startOfDay(parseISO(event.dueDate)), startOfDay(new Date()))
                          ? <span className="flex items-center justify-center text-xs font-medium text-destructive"><AlertCircle className="w-3 h-3 mr-1"/> Vencido</span>
                          : <span className="flex items-center justify-center text-xs font-medium text-blue-600"><Clock className="w-3 h-3 mr-1"/> Pendente</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Estilo local para sumir a scrollbar nativa na listinha dentro dos quadradinhos se houver overflow */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  )
}
