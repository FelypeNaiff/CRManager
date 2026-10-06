"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Building2, UserCircle, MapPin, Phone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

import { createSupplierAction, updateSupplierAction, SupplierInput } from "@/lib/crm/supplier-actions";

type SupplierFormProps = {
  initialData?: any;
};

// Mascaras simplificadas
const maskCnpj = (v: string) => v.replace(/\D/g,"").replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2").substring(0, 18);
const maskCpf = (v: string) => v.replace(/\D/g,"").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})\.(\d{3})(\d)/,"$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/,"$1.$2.$3-$4").substring(0, 14);
const maskPhone = (v: string) => v.replace(/\D/g,"").replace(/(\d{2})(\d)/,"($1) $2").replace(/(\d{4})(\d)/,"$1-$2").substring(0, 14);
const maskMobile = (v: string) => v.replace(/\D/g,"").replace(/(\d{2})(\d)/,"($1) $2").replace(/(\d{5})(\d)/,"$1-$2").substring(0, 15);
const maskCep = (v: string) => v.replace(/\D/g,"").replace(/^(\d{5})(\d)/,"$1-$2").substring(0, 9);

export function SupplierForm({ initialData }: SupplierFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [loading, setLoading] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);

  const [formData, setFormData] = useState<SupplierInput>({
    personType: initialData?.personType || "JURIDICA",
    name: initialData?.name || "",
    tradeName: initialData?.tradeName || "",
    cnpjCpf: initialData?.cnpjCpf || "",
    stateRegistration: initialData?.stateRegistration || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    mobile: initialData?.mobile || "",
    contactName: initialData?.contactName || "",
    cep: initialData?.cep || "",
    street: initialData?.street || "",
    number: initialData?.number || "",
    complement: initialData?.complement || "",
    neighborhood: initialData?.neighborhood || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    notes: initialData?.notes || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;
    
    if (name === "cnpjCpf") {
      value = formData.personType === "JURIDICA" ? maskCnpj(value) : maskCpf(value);
    }
    if (name === "phone") value = maskPhone(value);
    if (name === "mobile") value = maskMobile(value);
    if (name === "cep") {
      value = maskCep(value);
      if (value.replace(/\D/g, "").length === 8) {
        handleCepFetch(value);
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCepFetch = async (cepStr: string) => {
    const cleanCep = cepStr.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
        toast({ title: "Endereço preenchido automaticamente." });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingCep(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = isEditing 
        ? await updateSupplierAction(initialData.id, formData)
        : await createSupplierAction(formData);

      if (res.success) {
        toast({ title: "Sucesso!", description: `Fornecedor ${isEditing ? "atualizado" : "cadastrado"} com sucesso.` });
        router.push("/fornecedores");
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Erro", description: res.error });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro de rede" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/fornecedores")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold font-headline text-slate-800">
            {isEditing ? "Editar Fornecedor" : "Novo Fornecedor"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/fornecedores")}>Cancelar</Button>
          <Button className="bg-[#1e2229] hover:bg-black text-white" onClick={onSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            {isEditing ? "Atualizar" : "Cadastrar"}
          </Button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        
        {/* CARD 1: Dados Principais */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 font-bold text-lg mb-6 text-slate-800 border-b pb-2">
            <Building2 className="h-5 w-5 text-slate-400" />
            Dados Principais
          </div>

          <div className="mb-6">
            <Label className="mb-3 block text-slate-600">Tipo de pessoa</Label>
            <RadioGroup 
              value={formData.personType} 
              onValueChange={(val: "JURIDICA" | "FISICA") => {
                setFormData(p => ({ ...p, personType: val, cnpjCpf: "" }));
              }} 
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="JURIDICA" id="juridica" />
                <Label htmlFor="juridica">Pessoa Jurídica (CNPJ)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="FISICA" id="fisica" />
                <Label htmlFor="fisica">Pessoa Física (CPF)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Razão Social / Nome Completo *</Label>
              <Input required name="name" value={formData.name} onChange={handleChange} placeholder="Nome do fornecedor" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Nome Fantasia</Label>
              <Input name="tradeName" value={formData.tradeName || ""} onChange={handleChange} placeholder="Nome fantasia" className="h-11" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{formData.personType === "JURIDICA" ? "CNPJ" : "CPF"}</Label>
              <Input name="cnpjCpf" value={formData.cnpjCpf || ""} onChange={handleChange} placeholder={formData.personType === "JURIDICA" ? "00.000.000/0000-00" : "000.000.000-00"} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Inscrição Estadual (IE)</Label>
              <Input name="stateRegistration" value={formData.stateRegistration || ""} onChange={handleChange} placeholder="IE / RG" className="h-11" disabled={formData.personType === "FISICA"} />
            </div>
          </div>
        </div>

        {/* CARD 2: Informações de Contato */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 font-bold text-lg mb-6 text-slate-800 border-b pb-2">
            <Phone className="h-5 w-5 text-slate-400" />
            Informações de Contato
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Telefone Comercial</Label>
              <Input name="phone" value={formData.phone || ""} onChange={handleChange} placeholder="(00) 0000-0000" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Celular / WhatsApp</Label>
              <Input name="mobile" value={formData.mobile || ""} onChange={handleChange} placeholder="(00) 00000-0000" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" name="email" value={formData.email || ""} onChange={handleChange} placeholder="contato@empresa.com" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Contato / Representante</Label>
              <Input name="contactName" value={formData.contactName || ""} onChange={handleChange} placeholder="Nome da pessoa" className="h-11" />
            </div>
          </div>
        </div>

        {/* CARD 3: Endereço */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 font-bold text-lg mb-6 text-slate-800 border-b pb-2">
            <MapPin className="h-5 w-5 text-slate-400" />
            Endereço {fetchingCep && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input name="cep" value={formData.cep || ""} onChange={handleChange} placeholder="00000-000" className="h-11" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Logradouro / Rua</Label>
              <Input name="street" value={formData.street || ""} onChange={handleChange} placeholder="Rua, Av, etc" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input name="number" value={formData.number || ""} onChange={handleChange} placeholder="Nº" className="h-11" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input name="complement" value={formData.complement || ""} onChange={handleChange} placeholder="Sala, Galpão" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input name="neighborhood" value={formData.neighborhood || ""} onChange={handleChange} placeholder="Bairro" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input name="city" value={formData.city || ""} onChange={handleChange} placeholder="Cidade" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Estado (UF)</Label>
              <Select value={formData.state || ""} onValueChange={v => setFormData(p => ({ ...p, state: v }))}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* CARD 4: Observações Adicionais */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 font-bold text-lg mb-6 text-slate-800 border-b pb-2">
            <UserCircle className="h-5 w-5 text-slate-400" />
            Observações Adicionais
          </div>

          <div className="space-y-2">
            <Label>Notas Internas (Chaves PIX, Dados bancários, Prazos de entrega...)</Label>
            <Textarea 
              name="notes" value={formData.notes || ""} onChange={handleChange} 
              placeholder="Digite aqui as observações..." className="min-h-[120px] resize-y" 
            />
          </div>
        </div>

      </form>
    </div>
  );
}
