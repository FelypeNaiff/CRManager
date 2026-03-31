-- Multi-tenant core
CREATE TABLE IF NOT EXISTS lojas (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES lojas(id),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  role TEXT NOT NULL,
  senha_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- CRM
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES lojas(id),
  nome TEXT NOT NULL,
  telefone TEXT UNIQUE NOT NULL,
  segmento TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interacoes_cliente (
  id UUID PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES lojas(id),
  cliente_telefone TEXT NOT NULL,
  canal TEXT,
  descricao TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS filhos (
  id UUID PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES lojas(id),
  cliente_id UUID REFERENCES clientes(id),
  nome TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ERP/PDV/Estoque/Compras/Fiscal/Marketing/Agenda (estrutura base)
CREATE TABLE IF NOT EXISTS registros_modulares (
  id UUID PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES lojas(id),
  modulo TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
