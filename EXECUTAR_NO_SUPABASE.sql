-- ══════════════════════════════════════════════════════════════
--  EXECUTE ESTE SQL NO SUPABASE → SQL Editor → New Query
--  Copie tudo, cole lá e clique em RUN
-- ══════════════════════════════════════════════════════════════

-- 1. Adiciona colunas novas na tabela agendamentos
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS reservado_ate  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pix_valor      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pix_status     TEXT DEFAULT 'pendente';

-- 2. Cria tabela de pagamentos com UUID (compatível com o Supabase)
--    O Supabase usa UUID como tipo do id por padrão
CREATE TABLE IF NOT EXISTS pagamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id  UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
  valor           NUMERIC(10,2),
  valor_recebido  NUMERIC(10,2),
  status          TEXT DEFAULT 'aguardando_confirmacao',
  descricao       TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  pago_em         TIMESTAMPTZ,
  UNIQUE(agendamento_id)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_pagamentos_status      ON pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_reservado ON agendamentos(reservado_ate);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status    ON agendamentos(status);

-- 4. Permissões para o site conseguir ler e escrever
GRANT SELECT, INSERT, UPDATE ON pagamentos TO anon;
GRANT SELECT, INSERT, UPDATE ON pagamentos TO authenticated;

-- ✅ Pronto! Após executar, o site funcionará sem erros.
