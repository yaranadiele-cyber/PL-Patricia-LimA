// ═══════════════════════════════════════════════
//  SUPABASE CONFIG
// ═══════════════════════════════════════════════
const SUPABASE_URL  = "https://brikbjmzcmmdmemolobs.supabase.co";
const SUPABASE_KEY  = "sb_publishable_l7rc-j1GsAjQEpMQXGGiww_CMSudrve";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ═══════════════════════════════════════════════
//  AGENDAMENTOS
// ═══════════════════════════════════════════════
async function dbGetAgendamentos() {
  const { data, error } = await sb
    .from("agendamentos")
    .select("*")
    .order("data", { ascending: true })
    .order("hora", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function dbSalvarAgendamento(ag) {
  // tenta inserir com todos os campos
  const { data, error } = await sb
    .from("agendamentos")
    .insert([ag])
    .select()
    .single();

  if (!error) return data;

  // se der erro de coluna inexistente (ex: reservado_ate, pix_valor),
  // tenta de novo só com os campos básicos que sempre existem
  const msgErro = error?.message || "";
  const erroColuna = msgErro.includes("column") || msgErro.includes("schema") || error?.code === "PGRST204" || error?.code === "42703";

  if (erroColuna) {
    console.warn("Coluna nova não existe ainda no banco. Execute o SQL de atualização. Tentando salvar campos básicos...");
    const agBasico = {
      nome:      ag.nome,
      telefone:  ag.telefone,
      servico:   ag.servico,
      preco:     ag.preco,
      data:      ag.data,
      hora:      ag.hora,
      status:    ag.status === "reservado" ? "pendente" : (ag.status || "pendente"),
      pagamento: ag.pagamento || null
    };
    const { data: data2, error: error2 } = await sb
      .from("agendamentos")
      .insert([agBasico])
      .select()
      .single();
    if (error2) { console.error("Erro ao salvar agendamento:", error2); return null; }
    return data2;
  }

  console.error("Erro ao salvar agendamento:", error);
  return null;
}

async function dbAtualizarStatus(id, status) {
  const { error } = await sb
    .from("agendamentos")
    .update({ status })
    .eq("id", id);
  if (error) console.error(error);
}

async function dbDeletarAgendamento(id) {
  const { error } = await sb
    .from("agendamentos")
    .delete()
    .eq("id", id);
  if (error) console.error(error);
}

async function dbVerificarConflito(data, hora) {
  // horário já passou = livre
  const agora = new Date();
  if (new Date(`${data}T${hora}:00`) < agora) return false;

  const { data: rows, error } = await sb
    .from("agendamentos")
    .select("id, status, reservado_ate")
    .eq("data", data)
    .eq("hora", hora)
    .neq("status", "cancelado")
    .neq("status", "expirado");

  if (error || !rows?.length) return false;

  // bloqueia só se houver agendamento ativo (reserva não expirada ou já confirmado)
  return rows.some(r => {
    if (r.status === "reservado" && r.reservado_ate) {
      return new Date(r.reservado_ate) > agora;
    }
    return true; // pendente / confirmado / aguardando_confirmacao = bloqueado
  });
}

// ═══════════════════════════════════════════════
//  CONFIGURAÇÕES
// ═══════════════════════════════════════════════
async function dbGetConfig(chave, fallback) {
  const { data, error } = await sb
    .from("configuracoes")
    .select("valor")
    .eq("chave", chave)
    .single();
  if (error || !data) return fallback;
  try { return JSON.parse(data.valor); } catch { return data.valor; }
}

async function dbSetConfig(chave, valor) {
  const valorStr = JSON.stringify(valor);
  const { error } = await sb
    .from("configuracoes")
    .upsert({ chave, valor: valorStr }, { onConflict: "chave" });
  if (error) console.error(error);
}

async function dbGetAllConfigs() {
  const { data, error } = await sb
    .from("configuracoes")
    .select("*");
  if (error) return {};
  const obj = {};
  (data || []).forEach(r => {
    try { obj[r.chave] = JSON.parse(r.valor); } catch { obj[r.chave] = r.valor; }
  });
  return obj;
}
