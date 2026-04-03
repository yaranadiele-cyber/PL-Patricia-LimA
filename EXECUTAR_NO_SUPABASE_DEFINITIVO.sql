-- ══════════════════════════════════════════════════════════════════
--  EXECUTE ESTE SQL NO SUPABASE → SQL Editor → New Query
--  Copie TUDO, cole e clique em RUN
--  Resolve o problema da aba "Pagamentos" do painel admin
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Colunas novas na tabela agendamentos (seguro repetir) ─────
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS reservado_ate  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pix_valor      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pix_status     TEXT DEFAULT 'pendente';

-- ── 2. Remove tabela antiga se existir com tipo errado (BIGINT) ──
--  (Só executa o DROP se a coluna agendamento_id for BIGINT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagamentos'
      AND column_name = 'agendamento_id'
      AND data_type = 'bigint'
  ) THEN
    DROP TABLE IF EXISTS pagamentos;
    RAISE NOTICE 'Tabela pagamentos antiga (BIGINT) removida e será recriada com UUID.';
  END IF;
END $$;

-- ── 3. Cria tabela pagamentos com UUID (compatível com Supabase) ─
CREATE TABLE IF NOT EXISTS pagamentos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id  UUID        REFERENCES agendamentos(id) ON DELETE SET NULL,
  valor           NUMERIC(10,2),
  valor_recebido  NUMERIC(10,2),
  status          TEXT        DEFAULT 'aguardando_confirmacao',
  descricao       TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  pago_em         TIMESTAMPTZ,
  UNIQUE(agendamento_id)
);

-- ── 4. Índices para performance ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pagamentos_status      ON pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_ag_id       ON pagamentos(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_reservado ON agendamentos(reservado_ate);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status    ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data      ON agendamentos(data);

-- ── 5. Permissões para o site conseguir ler e escrever ────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON pagamentos  TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON pagamentos  TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON agendamentos TO anon;
GRANT SELECT, INSERT, UPDATE         ON agendamentos TO authenticated;

-- ── 6. Habilita Row Level Security (RLS) se não estiver ──────────
ALTER TABLE pagamentos  ENABLE ROW LEVEL SECURITY;

-- Política pública para leitura e escrita (site público)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='pagamentos' AND policyname='acesso_publico'
  ) THEN
    EXECUTE 'CREATE POLICY acesso_publico ON pagamentos FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ✅ PRONTO! Após executar, a aba Pagamentos do painel funcionará corretamente.
-- Se aparecer "permission denied" em agendamentos, execute também:
-- ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY acesso_publico ON agendamentos FOR ALL USING (true) WITH CHECK (true);
