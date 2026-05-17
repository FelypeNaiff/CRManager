export interface BaseModel {
  id: string;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  created_by: string;
  updated_by: string;
  status: 'ativo' | 'inativo' | 'arquivado';
}

export interface Cliente extends BaseModel {
  nome: string;
  email: string;
  telefone: string;
  documento: string;
  endereco: string;
}

export interface Filho extends BaseModel {
  cliente_id: string;
  nome: string;
  data_nascimento: Date;
  genero: string;
}

export interface CarteiraCliente extends BaseModel {
  cliente_id: string;
  saldo_atual: number;
}

export interface MovimentacaoSaldo extends BaseModel {
  carteira_id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
  referencia_id: string; // ID da Venda, Devolução, etc.
}

export interface TrocaDevolucao extends BaseModel {
  cliente_id: string;
  venda_id: string;
  valor_total: number;
  tipo: 'troca' | 'devolucao';
}

export interface Tag extends BaseModel {
  nome: string;
  cor: string;
}

export interface ClienteTag extends BaseModel {
  cliente_id: string;
  tag_id: string;
}

export interface HistoricoCliente extends BaseModel {
  cliente_id: string;
  tipo_acao: string;
  descricao: string;
}