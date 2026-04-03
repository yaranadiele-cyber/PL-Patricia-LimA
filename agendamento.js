// ═══════════════════════════════════════════════
//  NORMALIZAR TELEFONE
// ═══════════════════════════════════════════════
function normalizarTel(tel) {
  let t = (tel || "").replace(/\D/g, "");
  if (!t) return "";
  if (t.startsWith("55") && (t.length === 12 || t.length === 13)) return t;
  if (t.length === 10 || t.length === 11) return "55" + t;
  if (t.length === 8  || t.length === 9)  return "5582" + t;
  return "55" + t;
}

// ═══════════════════════════════════════════════
//  ESTADO GLOBAL
// ═══════════════════════════════════════════════
let dadosAgendamento     = {};
let pagamentoSelecionado = null;
let contagemRegressiva   = null;

// Serviços padrão — usados se o banco estiver vazio
const SERVICOS_PADRAO = [
  { nome: "Design de sobrancelha",           preco: 40  },
  { nome: "Design de sobrancelha com Henna", preco: 40  },
  { nome: "Design de unhas",                 preco: 150 },
  { nome: "Penteados",                       preco: 120 },
  { nome: "Maquiagem",                       preco: 35  }
];

function getCfgLocal(key, fallback) {
  try {
    const raw = localStorage.getItem("cfg_" + key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

// ═══════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════
window.onload = async function () {
  await carregarServicos();
  aplicarFrase();
};

async function aplicarFrase() {
  try {
    const frase = await dbGetConfig("frase", getCfgLocal("frase", "Realçando sua beleza natural"));
    const el = document.getElementById("frase-site");
    if (el && frase) el.textContent = frase;
  } catch(e) { console.warn("frase:", e); }
}

// ─── Serviços ────────────────────────────────
async function carregarServicos() {
  const select = document.getElementById("servico");
  if (!select) return;

  select.innerHTML = '<option value="">Carregando serviços...</option>';

  let servicos = [];
  try {
    const completos = await dbGetConfig("servicosCompletos", null);
    if (completos && Array.isArray(completos) && completos.length > 0) {
      servicos = completos;
    } else {
      const basicos = await dbGetConfig("servicos", null);
      if (basicos && Array.isArray(basicos) && basicos.length > 0) {
        servicos = basicos;
      }
    }
  } catch(e) {
    console.warn("Erro ao buscar serviços do banco:", e);
  }

  if (!servicos.length) {
    const local = getCfgLocal("servicosCompletos", null) || getCfgLocal("servicos", null);
    if (local && Array.isArray(local) && local.length > 0) servicos = local;
  }

  if (!servicos.length) servicos = SERVICOS_PADRAO;

  select.innerHTML = servicos.map(s => {
    const nome  = String(s.nome  || "").trim();
    const preco = parseFloat(s.preco) || 0;
    const label = nome + (preco ? ` — R$ ${preco.toFixed(2)}` : "");
    return `<option value="${nome}" data-preco="${preco}">${label}</option>`;
  }).join("");
}

// ─── Horários — Grade Visual ─────────────────
async function carregarHorarios() {
  const dataSel    = document.getElementById("data")?.value || "";
  const grade      = document.getElementById("horarios-grade");
  const horaHidden = document.getElementById("hora");
  if (!grade) return;

  if (!dataSel) {
    grade.innerHTML = '<div class="aviso-sem-data">Selecione uma data para ver os horários 📅</div>';
    if (horaHidden) horaHidden.value = "";
    return;
  }

  grade.innerHTML = '<div class="aviso-sem-data" style="opacity:.6">⏳ Carregando horários...</div>';

  const horariosAtivos  = await dbGetConfig("horariosAtivos",  getCfgLocal("horariosAtivos",  ["09:00","10:00","11:00","13:00","14:00","15:00"]));
  const datasBloqueadas = await dbGetConfig("datasBloqueadas", getCfgLocal("datasBloqueadas", []));

  if ((datasBloqueadas || []).includes(dataSel)) {
    grade.innerHTML = '<div class="aviso-sem-data">❌ Esta data está indisponível</div>';
    if (horaHidden) horaHidden.value = "";
    return;
  }

  const agora = new Date();
  const hoje  = agora.toISOString().split("T")[0];

  let rows = [];
  try {
    const { data, error } = await sb.from("agendamentos")
      .select("hora, data, status, reservado_ate")
      .eq("data", dataSel)
      .neq("status", "cancelado")
      .neq("status", "expirado");

    if (error) {
      const { data: data2 } = await sb.from("agendamentos")
        .select("hora, data, status")
        .eq("data", dataSel)
        .neq("status", "cancelado");
      rows = data2 || [];
    } else {
      rows = data || [];
    }
  } catch(e) { rows = []; }

  const ocupados = rows.filter(r => {
    const dataHora = new Date(`${r.data}T${r.hora}:00`);
    if (dataHora < agora) return false;
    if (r.status === "reservado" && r.reservado_ate) {
      return new Date(r.reservado_ate) > agora;
    }
    return true;
  }).map(r => r.hora);

  const horaSelecionada = horaHidden?.value || "";
  const lista = Array.isArray(horariosAtivos) ? horariosAtivos : ["09:00","10:00","11:00","13:00","14:00","15:00"];

  grade.innerHTML = lista.map(h => {
    const jaPassou = dataSel === hoje && new Date(`${dataSel}T${h}:00`) < agora;
    const ocupado  = ocupados.includes(h);

    let classe = "disponivel", tag = "Disponível", disabled = "";
    if (jaPassou)     { classe = "encerrado"; tag = "Encerrado"; disabled = "disabled"; }
    else if (ocupado) { classe = "ocupado";   tag = "Ocupado";   disabled = "disabled"; }

    const sel = (!disabled && h === horaSelecionada) ? " selecionado" : "";
    return `<button type="button" class="horario-btn ${classe}${sel}" ${disabled} ${disabled ? "" : `onclick="selecionarHorario('${h}')"`}>
      <span class="h-hora">${h}</span>
      <span class="h-tag">${tag}</span>
    </button>`;
  }).join("");

  const horarioValido = horaSelecionada && lista.includes(horaSelecionada)
    && !ocupados.includes(horaSelecionada)
    && !(dataSel === hoje && new Date(`${dataSel}T${horaSelecionada}:00`) < agora);

  if (!horarioValido) {
    const primeiro = lista.find(h => {
      return !(dataSel === hoje && new Date(`${dataSel}T${h}:00`) < agora) && !ocupados.includes(h);
    });
    if (primeiro) selecionarHorario(primeiro);
    else if (horaHidden) horaHidden.value = "";
  }
}

function selecionarHorario(h) {
  const horaHidden = document.getElementById("hora");
  if (horaHidden) horaHidden.value = h;
  document.querySelectorAll(".horario-btn.disponivel").forEach(btn => {
    btn.classList.toggle("selecionado", btn.querySelector(".h-hora")?.textContent.trim() === h);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const dataInput = document.getElementById("data");
  if (dataInput) dataInput.addEventListener("change", carregarHorarios);

  // Define data mínima como hoje
  const hoje = new Date().toISOString().split("T")[0];
  if (dataInput) dataInput.min = hoje;
});

// ═══════════════════════════════════════════════
//  ETAPA 1 → 2
// ═══════════════════════════════════════════════
async function irParaPagamento() {
  const nome      = document.getElementById("nome").value.trim();
  const telefone  = document.getElementById("telefone").value.trim();
  const servicoEl = document.getElementById("servico");
  const servico   = (servicoEl?.value || "").trim();
  const precoRaw  = servicoEl?.selectedOptions[0]?.getAttribute("data-preco") || "0";
  const preco     = parseFloat(precoRaw) || 0;
  const data      = document.getElementById("data").value;
  const hora      = document.getElementById("hora").value;

  if (!nome || !telefone || !data || !servico) {
    alert("Preencha todos os campos antes de continuar.");
    return;
  }
  if (!hora) {
    alert("Selecione um horário disponível antes de continuar.");
    return;
  }
  if (new Date(`${data}T${hora}:00`) < new Date()) {
    alert("Este horário já passou. Escolha outra data ou horário.");
    await carregarHorarios();
    return;
  }

  const conflito = await dbVerificarConflito(data, hora);
  if (conflito) {
    alert("Esse horário acabou de ser reservado. Por favor, escolha outro.");
    await carregarHorarios();
    return;
  }

  // Reserva por 30 min
  const reservadoAte = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const ag = await dbSalvarAgendamento({
    nome,
    telefone: normalizarTel(telefone),
    servico, preco, data, hora,
    status:        "reservado",
    reservado_ate: reservadoAte,
    pagamento:     null
  });

  if (!ag) {
    alert("Erro ao reservar horário. Tente novamente.");
    return;
  }

  dadosAgendamento = { id: ag.id, nome, telefone: normalizarTel(telefone), servico, preco, data, hora };

  const dataFmt = data.split("-").reverse().join("/");
  document.getElementById("resumo").innerHTML = `
    <div class="linha-resumo"><span>Serviço</span><strong>${servico}</strong></div>
    <div class="linha-resumo"><span>Data</span><strong>${dataFmt} às ${hora}</strong></div>
    <div class="linha-resumo"><span>Nome</span><strong>${nome}</strong></div>
    ${preco ? `<div class="linha-resumo"><span>Valor total</span><strong>R$ ${preco.toFixed(2)}</strong></div>` : ""}
  `;

  const modoEntrada = await dbGetConfig("pixEntrada", getCfgLocal("pixEntrada", "opcao"));
  const pixOpcoes   = document.getElementById("pix-opcoes");

  pagamentoSelecionado = null;

  irParaTela(2);
  iniciarContagemRegressiva(reservadoAte);

  document.getElementById("pix-info").style.display = "none";
  esconderBtnPaguei();

  // Modo 0 = sem pagamento antecipado
  if (modoEntrada === "0") {
    if (contagemRegressiva) clearInterval(contagemRegressiva);
    const timerEl = document.getElementById("timer-reserva");
    if (timerEl) timerEl.style.display = "none";
    confirmarSemPagamento();
    return;
  }

  if (modoEntrada === "opcao") {
    const metade = preco ? (preco / 2).toFixed(2) : null;
    pixOpcoes.innerHTML = `
      <div class="pix-card" id="op-50" onclick="selecionarPagamento('50')">
        <div class="check-badge">✓</div>
        <div class="pix-icone">💸</div>
        <div class="pix-titulo">50% agora</div>
        ${metade ? `<div class="pix-valor">R$ ${metade}</div>` : ""}
        <div class="pix-desc">Entrada via Pix.<br>Restante no dia.</div>
      </div>
      <div class="pix-card" id="op-total" onclick="selecionarPagamento('total')">
        <div class="check-badge">✓</div>
        <div class="pix-icone">✅</div>
        <div class="pix-titulo">Total agora</div>
        ${preco ? `<div class="pix-valor">R$ ${preco.toFixed(2)}</div>` : ""}
        <div class="pix-desc">Pague tudo via Pix<br>e garanta o horário.</div>
      </div>`;
  } else if (modoEntrada === "50") {
    const metade = preco ? (preco / 2).toFixed(2) : null;
    pixOpcoes.innerHTML = `
      <div class="pix-card" id="op-50" style="grid-column:1/-1" onclick="selecionarPagamento('50')">
        <div class="check-badge">✓</div>
        <div class="pix-icone">💸</div>
        <div class="pix-titulo">Entrada de 50% obrigatória</div>
        ${metade ? `<div class="pix-valor">R$ ${metade}</div>` : ""}
        <div class="pix-desc">Pague via Pix para confirmar.<br>Restante no dia do atendimento.</div>
      </div>`;
    selecionarPagamento("50");
  } else if (modoEntrada === "30") {
    const trintaPct = preco ? (preco * 0.3).toFixed(2) : null;
    pixOpcoes.innerHTML = `
      <div class="pix-card" id="op-30" style="grid-column:1/-1" onclick="selecionarPagamento('30')">
        <div class="check-badge">✓</div>
        <div class="pix-icone">💸</div>
        <div class="pix-titulo">Entrada de 30% obrigatória</div>
        ${trintaPct ? `<div class="pix-valor">R$ ${trintaPct}</div>` : ""}
        <div class="pix-desc">Pague via Pix para confirmar.<br>Restante no dia do atendimento.</div>
      </div>`;
    selecionarPagamento("30");
  }
}

// ═══════════════════════════════════════════════
//  HELPERS BOTÃO JÁ PAGUEI
// ═══════════════════════════════════════════════
function mostrarBtnPaguei() {
  const btn = document.getElementById("btn-ja-paguei");
  if (!btn) return;
  btn.style.display = "flex";
  btn.disabled = false;
  btn.textContent = "✅ Já paguei — Enviar comprovante pelo WhatsApp";
}
function esconderBtnPaguei() {
  const btn = document.getElementById("btn-ja-paguei");
  if (btn) btn.style.display = "none";
}

// ═══════════════════════════════════════════════
//  CONTAGEM REGRESSIVA
// ═══════════════════════════════════════════════
function iniciarContagemRegressiva(reservadoAte) {
  if (contagemRegressiva) clearInterval(contagemRegressiva);
  const expira  = new Date(reservadoAte).getTime();
  const timerEl = document.getElementById("timer-reserva");
  if (timerEl) timerEl.style.display = "block";

  function tick() {
    const el = document.getElementById("timer-reserva");
    if (!el) return;
    const restante = expira - Date.now();
    if (restante <= 0) {
      clearInterval(contagemRegressiva);
      el.innerHTML   = `⏰ Reserva expirada! O horário foi liberado. <a href="agendamento.html" style="color:#e38f7a;font-weight:600">Tente novamente</a>`;
      el.style.background   = "rgba(255,100,100,0.18)";
      el.style.borderColor  = "rgba(255,100,100,0.35)";
      el.style.color        = "#7a0000";
      if (dadosAgendamento.id) dbAtualizarStatus(dadosAgendamento.id, "expirado");
      esconderBtnPaguei();
      return;
    }
    const min = Math.floor(restante / 60000);
    const seg = Math.floor((restante % 60000) / 1000);
    const urg = restante < 5 * 60 * 1000;
    el.innerHTML = `${urg ? "🔴" : "⏳"} Horário reservado por <strong>${min}:${String(seg).padStart(2,"0")}</strong> — pague para confirmar`;
    el.style.background  = urg ? "rgba(255,150,50,0.22)" : "rgba(240,192,96,0.18)";
    el.style.borderColor = urg ? "rgba(255,150,50,0.4)"  : "rgba(240,192,96,0.38)";
    el.style.color       = urg ? "#7a3300" : "#7a5700";
  }
  tick();
  contagemRegressiva = setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════
//  SELECIONAR PAGAMENTO
// ═══════════════════════════════════════════════
async function selecionarPagamento(opcao) {
  pagamentoSelecionado = opcao;
  document.querySelectorAll(".pix-card").forEach(c => c.classList.remove("selecionado"));
  const card = document.getElementById("op-" + opcao);
  if (card) {
    card.classList.add("selecionado");
    const badge = card.querySelector(".check-badge");
    if (badge) badge.style.display = "flex";
  }

  const preco    = dadosAgendamento.preco || 0;
  const valorPix = opcao === "50" ? preco / 2 : opcao === "30" ? preco * 0.3 : preco;

  const pixChave = await dbGetConfig("pixChave", getCfgLocal("pixChave", ""));
  const pixNome  = await dbGetConfig("pixNome",  getCfgLocal("pixNome",  "Patricia Lima"));
  const whatsapp = await dbGetConfig("whatsapp", getCfgLocal("whatsapp", "5582996692302"));
  localStorage.setItem("cfg_pixChave", JSON.stringify(pixChave));
  localStorage.setItem("cfg_pixNome",  JSON.stringify(pixNome));
  localStorage.setItem("cfg_whatsapp", JSON.stringify(whatsapp));

  const infoEl = document.getElementById("pix-info");
  if (infoEl) infoEl.style.display = "block";

  const nomeEl = document.getElementById("pix-nome-display");
  if (nomeEl) nomeEl.textContent = pixNome || "Patricia Lima";

  const valorEl = document.getElementById("pix-valor-display");
  if (valorEl) valorEl.textContent = valorPix ? `R$ ${valorPix.toFixed(2)}` : "—";

  const chaveEl = document.getElementById("pix-chave-display");
  if (chaveEl) chaveEl.textContent = pixChave || "Configure a chave Pix no painel admin";

  mostrarBtnPaguei();
}

function copiarChave() {
  const chave = document.getElementById("pix-chave-display")?.textContent || "";
  navigator.clipboard.writeText(chave).then(() => {
    const btn = document.querySelector(".btn-copiar");
    if (btn) { btn.textContent = "✅ Copiado!"; setTimeout(() => { btn.textContent = "📋 Copiar"; }, 2000); }
  }).catch(() => {
    const el = document.createElement("textarea");
    el.value = chave; document.body.appendChild(el);
    el.select(); document.execCommand("copy"); document.body.removeChild(el);
    const btn = document.querySelector(".btn-copiar");
    if (btn) { btn.textContent = "✅ Copiado!"; setTimeout(() => { btn.textContent = "📋 Copiar"; }, 2000); }
  });
}

// ═══════════════════════════════════════════════
//  JÁ PAGUEI — abre WhatsApp do CLIENTE e notifica PATRICIA
// ═══════════════════════════════════════════════
function finalizarAgendamento() {
  if (!pagamentoSelecionado) { alert("Selecione uma opção de pagamento."); return; }

  const { nome, telefone, servico, data, hora, preco } = dadosAgendamento;
  const modoPag   = pagamentoSelecionado;
  const valorPago = modoPag === "50" ? preco / 2 : modoPag === "30" ? preco * 0.3 : preco;
  const dataFmt   = data.split("-").reverse().join("/");

  let linhaPag = "";
  if (modoPag === "total" && valorPago > 0)
    linhaPag = `\n💰 Valor pago: R$ ${valorPago.toFixed(2)} (total)`;
  else if (modoPag === "50" && valorPago > 0)
    linhaPag = `\n💰 Valor pago: R$ ${valorPago.toFixed(2)} (entrada 50% — restante no dia)`;
  else if (modoPag === "30" && valorPago > 0)
    linhaPag = `\n💰 Valor pago: R$ ${valorPago.toFixed(2)} (entrada 30% — restante no dia)`;

  const numeroWpp = normalizarTel(getCfgLocal("whatsapp", "5582996692302"));
  const pixChave  = getCfgLocal("pixChave", "");

  // Mensagem que o CLIENTE envia com o comprovante
  const mensagemCliente =
    `Olá Patricia! 👋 Realizei o agendamento e já efetuei o pagamento via Pix.\n\n` +
    `👤 Nome: ${nome}\n💅 Serviço: ${servico}\n📅 Data: ${dataFmt}\n🕐 Hora: ${hora}` +
    linhaPag +
    (pixChave ? `\n📲 Chave Pix: ${pixChave}` : "") +
    `\n\n📎 Comprovante em anexo 👇\n_(envie o print aqui)_`;

  window._wppLink = `https://wa.me/${numeroWpp}?text=${encodeURIComponent(mensagemCliente)}`;

  // Abre WhatsApp do cliente IMEDIATAMENTE (sem await)
  window.open(window._wppLink, "_blank");

  // Notificação para PATRICIA após 1.5s
  const telCliente = telefone ? ` | 📱 ${telefone}` : "";
  const mensagemPatricia =
    `🔔 *NOVO AGENDAMENTO — confirme no painel!*\n\n` +
    `👤 ${nome}${telCliente}\n` +
    `💅 ${servico}\n📅 ${dataFmt} às ${hora}` +
    linhaPag +
    `\n\n✅ Acesse o painel para confirmar.`;

  window._wppPatriciaLink = `https://wa.me/${numeroWpp}?text=${encodeURIComponent(mensagemPatricia)}`;
  setTimeout(() => { window.open(window._wppPatriciaLink, "_blank"); }, 1500);

  const btn = document.getElementById("btn-ja-paguei");
  if (btn) { btn.disabled = true; btn.textContent = "✅ WhatsApp aberto!"; }

  // Salva no banco em segundo plano
  _salvarPagamentoNoBanco(modoPag, valorPago, dataFmt, servico, hora);
}

async function _salvarPagamentoNoBanco(modoPag, valorPago, dataFmt, servico, hora) {
  const { id } = dadosAgendamento;
  if (id) {
    // Tenta atualizar com pix_valor, fallback sem ele
    const { error } = await sb.from("agendamentos").update({
      status: "aguardando_confirmacao", pagamento: modoPag, pix_valor: valorPago
    }).eq("id", id);
    if (error) {
      await sb.from("agendamentos").update({
        status: "aguardando_confirmacao", pagamento: modoPag
      }).eq("id", id);
    }
    // Tenta inserir na tabela pagamentos (pode não existir ainda)
    await sb.from("pagamentos").upsert([{
      agendamento_id: id,
      valor:          valorPago,
      status:         "aguardando_confirmacao",
      descricao:      `${servico} - ${dataFmt} às ${hora}`,
      criado_em:      new Date().toISOString()
    }], { onConflict: "agendamento_id" }).catch(e => console.warn("pagamentos:", e));
  }
  if (contagemRegressiva) clearInterval(contagemRegressiva);

  const { servico: sv, data, hora: hr } = dadosAgendamento;
  const df = data.split("-").reverse().join("/");
  const sucEl = document.getElementById("sucesso-texto");
  if (sucEl) sucEl.textContent =
    `${sv}\n📅 ${df} às ${hr}` + (valorPago > 0 ? `\n💰 R$ ${valorPago.toFixed(2)} enviado via Pix` : "");

  const checklist = document.getElementById("checklist-sucesso");
  if (checklist) {
    checklist.innerHTML = `
      <div class="check-item check-ok">✅ Agendamento registrado no sistema</div>
      <div class="check-item check-ok">✅ WhatsApp aberto com os dados</div>
      <div class="check-item check-ok" style="background:rgba(110,203,139,0.28);font-weight:600">📎 Envie o <strong>print do comprovante</strong> na conversa aberta</div>
      <div class="check-item check-pendente">⏳ Patricia confirmará seu horário após verificar</div>`;
    checklist.style.display = "flex";
  }
  const btnReabrir = document.getElementById("btn-reabrir-wpp");
  if (btnReabrir) btnReabrir.style.display = "flex";

  irParaTela(3);
}

// ─── Sem pagamento antecipado ────────────────
function confirmarSemPagamento() {
  const { id, nome, telefone, servico, data, hora } = dadosAgendamento;
  const dataFmt   = data.split("-").reverse().join("/");
  const numeroWpp = normalizarTel(getCfgLocal("whatsapp", "5582996692302"));

  // Mensagem do CLIENTE
  const mensagemCliente =
    `Olá Patricia! Gostaria de confirmar meu agendamento:\n\n` +
    `👤 Nome: ${nome}\n💅 Serviço: ${servico}\n📅 Data: ${dataFmt}\n🕐 Hora: ${hora}`;
  window._wppLink = `https://wa.me/${numeroWpp}?text=${encodeURIComponent(mensagemCliente)}`;
  window.open(window._wppLink, "_blank");

  // Notificação para PATRICIA
  const telCliente = telefone ? ` | 📱 ${telefone}` : "";
  const mensagemPatricia =
    `🔔 *NOVO AGENDAMENTO — confirme no painel!*\n\n` +
    `👤 ${nome}${telCliente}\n` +
    `💅 ${servico}\n📅 ${dataFmt} às ${hora}\n\n` +
    `✅ Acesse o painel para confirmar.`;
  window._wppPatriciaLink = `https://wa.me/${numeroWpp}?text=${encodeURIComponent(mensagemPatricia)}`;
  setTimeout(() => { window.open(window._wppPatriciaLink, "_blank"); }, 1500);

  if (id) dbAtualizarStatus(id, "pendente");

  const sucEl = document.getElementById("sucesso-texto");
  if (sucEl) sucEl.textContent = `${servico}\n📅 ${dataFmt} às ${hora}`;

  const checklist = document.getElementById("checklist-sucesso");
  if (checklist) {
    checklist.innerHTML = `
      <div class="check-item check-ok">✅ Agendamento registrado</div>
      <div class="check-item check-ok">✅ Mensagem enviada para Patricia</div>
      <div class="check-item check-pendente">⏳ Aguarde Patricia confirmar seu horário</div>`;
    checklist.style.display = "flex";
  }
  const btnReabrir = document.getElementById("btn-reabrir-wpp");
  if (btnReabrir) btnReabrir.style.display = "flex";

  irParaTela(3);
}

function reabrirWhatsapp() {
  if (window._wppLink) window.open(window._wppLink, "_blank");
}

// ═══════════════════════════════════════════════
//  NAVEGAÇÃO ENTRE TELAS
// ═══════════════════════════════════════════════
function irParaTela(n) {
  document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
  const tela = document.getElementById("tela-" + n);
  if (tela) tela.classList.add("ativa");

  [1,2,3].forEach(i => {
    const circ = document.getElementById("circ-" + i);
    const lbl  = document.getElementById("lbl-" + i);
    if (!circ) return;
    circ.classList.remove("ativa","feita");
    if (lbl) lbl.classList.remove("ativa");
    if (i < n)        { circ.classList.add("feita"); circ.textContent = "✓"; }
    else if (i === n) { circ.classList.add("ativa"); circ.textContent = i; if(lbl) lbl.classList.add("ativa"); }
    else              { circ.textContent = i; }
  });

  const btnVoltar = document.getElementById("btn-voltar-inicio");
  if (btnVoltar) btnVoltar.style.display = n === 3 ? "none" : "flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function voltarEtapa1() {
  if (dadosAgendamento.id) {
    dbAtualizarStatus(dadosAgendamento.id, "cancelado");
    dadosAgendamento = {};
  }
  if (contagemRegressiva) clearInterval(contagemRegressiva);
  pagamentoSelecionado = null;
  irParaTela(1);
}
