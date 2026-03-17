-- ══════════════════════════════════════════════════════
--  Execute no Supabase → SQL Editor
--  Adiciona suporte a reserva temporária e histórico de pagamentos
-- ══════════════════════════════════════════════════════

-- 1. Novas colunas na tabela agendamentos
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS reservado_ate  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pix_valor      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pix_status     TEXT DEFAULT 'pendente';

-- 2. Tabela de histórico de pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
  id              BIGSERIAL PRIMARY KEY,
  agendamento_id  BIGINT REFERENCES agendamentos(id) ON DELETE SET NULL,
  valor           NUMERIC(10,2),
  valor_recebido  NUMERIC(10,2),
  status          TEXT DEFAULT 'aguardando_confirmacao',
  descricao       TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  pago_em         TIMESTAMPTZ,
  UNIQUE(agendamento_id)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_reservado ON agendamentos(reservado_ate);

-- 4. Permissões para leitura/escrita pública (necessário para o site funcionar)
GRANT SELECT, INSERT, UPDATE ON pagamentos TO anon;
GRANT SELECT, INSERT, UPDATE ON pagamentos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE pagamentos_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE pagamentos_id_seq TO authenticated;
