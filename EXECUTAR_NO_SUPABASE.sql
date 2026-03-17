-- ══════════════════════════════════════════════════════════════
--  EXECUTE ESTE SQL NO SUPABASE → SQL Editor → New Query
--  Copie tudo, cole lá e clique em RUN
-- ══════════════════════════════════════════════════════════════

-- 1. Adiciona colunas novas na tabela agendamentos
--    (IF NOT EXISTS evita erro se já existir)
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS reservado_ate  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pix_valor      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pix_status     TEXT DEFAULT 'pendente';

-- 2. Cria tabela de histórico de pagamentos
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

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_pagamentos_status     ON pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_reservado ON agendamentos(reservado_ate);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status    ON agendamentos(status);

-- 4. Permissões (obrigatório para o site conseguir ler/escrever)
GRANT SELECT, INSERT, UPDATE ON pagamentos TO anon;
GRANT SELECT, INSERT, UPDATE ON pagamentos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE pagamentos_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE pagamentos_id_seq TO authenticated;

-- ✅ Pronto! Após executar, o site funcionará sem erros.
