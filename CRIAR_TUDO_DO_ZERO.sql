-- ══════════════════════════════════════════════════════════════════
--  EXECUTE ESTE SQL NO SUPABASE → SQL Editor → New Query
--  Cria TODAS as tabelas do zero (projeto novo)
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Tabela principal de agendamentos ──────────────────────────
CREATE TABLE IF NOT EXISTS agendamentos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT        NOT NULL,
  telefone      TEXT,
  servico       TEXT,
  preco         NUMERIC(10,2),
  data          DATE,
  hora          TEXT,
  status        TEXT        DEFAULT 'pendente',
  pagamento     TEXT,
  reservado_ate TIMESTAMPTZ,
  pix_valor     NUMERIC(10,2),
  pix_status    TEXT        DEFAULT 'pendente',
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Tabela de configurações do painel ─────────────────────────
CREATE TABLE IF NOT EXISTS configuracoes (
  id        BIGSERIAL   PRIMARY KEY,
  chave     TEXT        UNIQUE NOT NULL,
  valor     TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Tabela de pagamentos ──────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_agendamentos_data      ON agendamentos(data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status    ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_reservado ON agendamentos(reservado_ate);
CREATE INDEX IF NOT EXISTS idx_configuracoes_chave    ON configuracoes(chave);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status      ON pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_ag_id       ON pagamentos(agendamento_id);

-- ── 5. Habilita RLS (Row Level Security) ─────────────────────────
ALTER TABLE agendamentos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos     ENABLE ROW LEVEL SECURITY;

-- ── 6. Políticas de acesso público (necessário para o site) ──────
CREATE POLICY "acesso_publico" ON agendamentos  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acesso_publico" ON configuracoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acesso_publico" ON pagamentos    FOR ALL USING (true) WITH CHECK (true);

-- ── 7. Permissões ────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON agendamentos  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON configuracoes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pagamentos    TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE configuracoes_id_seq  TO anon, authenticated;

-- ── 8. Configurações padrão do site ──────────────────────────────
INSERT INTO configuracoes (chave, valor) VALUES
  ('nome',            '"Patricia Lima"'),
  ('frase',           '"Realçando sua beleza natural"'),
  ('whatsapp',        '"5582996692302"'),
  ('instagram',       '"patricialima1302"'),
  ('pixChave',        '""'),
  ('pixNome',         '"Patricia Lima"'),
  ('pixEntrada',      '"opcao"'),
  ('horariosAtivos',  '["09:00","10:00","11:00","13:00","14:00","15:00"]'),
  ('datasBloqueadas', '[]'),
  ('msgConfirmacao',  '"Olá {nome}! Seu agendamento foi CONFIRMADO. ✅\n\nServiço: {servico}\nData: {data}\nHora: {hora}\n\nSeu horário está garantido! Até lá 💅\n— Patricia Lima"'),
  ('msgCancelamento', '"Olá {nome}. Infelizmente seu agendamento foi CANCELADO.\n\nServiço: {servico}\nData: {data}\nHora: {hora}\n\nEntre em contato para reagendar."'),
  ('usuario',         '"patricia"'),
  ('senha',           '"pl2026"')
ON CONFLICT (chave) DO NOTHING;

-- ✅ PRONTO! Todas as tabelas criadas. Agora atualize o supabase.js com a nova URL e chave.
