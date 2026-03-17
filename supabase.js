// ═══════════════════════════════════════════════
//  SUPABASE CONFIG
// ═══════════════════════════════════════════════
const SUPABASE_URL  = "https://oenrdiuphuynpwbjxlul.supabase.co";
const SUPABASE_KEY  = "sb_publishable_xu5E3R8SM_nL_ApFESHAyg_fpV7Lmri";

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
  const { data, error } = await sb
    .from("agendamentos")
    .insert([ag])
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return data;
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
  // Se a data/hora já passaram, considera livre automaticamente
  const agora = new Date();
  const dataHoraAgendamento = new Date(`${data}T${hora}:00`);
  if (dataHoraAgendamento < agora) return false;

  const { data: rows, error } = await sb
    .from("agendamentos")
    .select("id")
    .eq("data", data)
    .eq("hora", hora)
    .neq("status", "cancelado");
  if (error) return false;
  return rows && rows.length > 0;
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
