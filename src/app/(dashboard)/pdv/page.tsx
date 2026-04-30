"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Receipt,
  User,
  ShoppingBag,
  TicketPercent,
  QrCode,
  Loader2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection } from "firebase/firestore"

export default function PDVPage() {
  const [cart, setCart] = useState<{product: any, quantity: number}[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const db = useFirestore()

  const produtosQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "produtos")
  }, [db])

  const { data: products, isLoading } = useCollection(produtosQuery)

  const filteredProducts = (products || []).filter(p => 
    p.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    toast({
      title: "Produto adicionado",
      description: `${product.nome} foi adicionado ao carrinho.`
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQty }
      }
      return item
    }))
  }

  const subtotal = cart.reduce((acc, item) => acc + (item.product.precoVenda * item.quantity), 0)
  const discount = 0
  const total = subtotal - discount

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        variant: "destructive",
        title: "Carrinho vazio",
        description: "Adicione produtos antes de finalizar a venda."
      })
      return
    }
    toast({
      title: "Venda finalizada",
      description: `Venda de R$ ${total.toFixed(2)} processada com sucesso!`
    })
    setCart([])
  }

  return (
    <div className="flex h-full flex-col lg:flex-row gap-6">
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar produtos por nome ou código..." 
              className="pl-10 h-11"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11">
            <ShoppingBag className="mr-2 h-4 w-4" /> Categorias
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-muted-foreground">Carregando produtos...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 border rounded-xl bg-muted/10">
              <p className="text-muted-foreground">Nenhum produto disponível.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
              {filteredProducts.map((product) => (
                <Card 
                  key={product.id} 
                  className="overflow-hidden group hover:shadow-md transition-all cursor-pointer border-secondary"
                  onClick={() => addToCart(product)}
                >
                  <div className="aspect-square relative overflow-hidden bg-secondary/30">
                    <img 
                      src={product.fotoUrl || "https://picsum.photos/seed/placeholder/200/200"} 
                      alt={product.nome} 
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                    />
                    <Badge className="absolute top-2 left-2 bg-primary/90">
                      {product.categoria || "Geral"}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm line-clamp-1">{product.nome}</h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-primary">R$ {product.precoVenda?.toFixed(2)}</span>
                      <span className={`text-[10px] ${product.estoqueAtual < 10 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        Estoque: {product.estoqueAtual}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <Card className="w-full lg:w-[400px] flex flex-col h-[calc(100vh-10rem)] shadow-lg border-primary/10">
        <CardHeader className="bg-primary/5 py-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" /> Carrinho
            </CardTitle>
            <Badge variant="secondary">{cart.length} itens</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
          <div className="p-4 bg-secondary/10 border-b flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">Cliente</p>
              <p className="text-sm font-semibold">Consumidor Final</p>
            </div>
            <Button variant="ghost" size="sm" className="text-primary">Alterar</Button>
          </div>

          <ScrollArea className="flex-1 px-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 opacity-20 mb-4" />
                <p>Carrinho vazio</p>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex gap-3 animate-in fade-in slide-in-from-right-2 duration-200">
                    <div className="h-14 w-14 rounded border overflow-hidden shrink-0 bg-secondary/20">
                      <img src={item.product.fotoUrl || "https://picsum.photos/seed/placeholder/100/100"} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product.nome}</p>
                      <p className="text-xs font-bold text-primary">R$ {item.product.precoVenda?.toFixed(2)}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center border rounded h-7">
                          <button 
                            onClick={(e) => {e.stopPropagation(); updateQuantity(item.product.id, -1)}}
                            className="px-2 hover:bg-secondary transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2 text-xs font-bold w-6 text-center">{item.quantity}</span>
                          <button 
                            onClick={(e) => {e.stopPropagation(); updateQuantity(item.product.id, 1)}}
                            className="px-2 hover:bg-secondary transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button 
                          onClick={(e) => {e.stopPropagation(); removeFromCart(item.product.id)}}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">R$ {(item.product.precoVenda * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex-col gap-4 p-4 bg-primary/5 border-t">
          <div className="w-full space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-emerald-600">
              <span className="flex items-center gap-1"><TicketPercent className="h-4 w-4" /> Desconto</span>
              <span>- R$ {discount.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center pt-1">
              <span className="font-headline font-bold text-lg">Total</span>
              <span className="font-headline font-bold text-2xl text-primary">R$ {total.toFixed(2)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button variant="outline" className="gap-2">
              <QrCode className="h-4 w-4" /> PIX
            </Button>
            <Button variant="outline" className="gap-2">
              <CreditCard className="h-4 w-4" /> Cartão
            </Button>
          </div>
          <Button className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" onClick={handleCheckout}>
            <Receipt className="mr-2 h-5 w-5" /> Finalizar Venda (F10)
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
