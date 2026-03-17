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

function getCfgLocal(key, fallback) {
  const raw = localStorage.getItem("cfg_" + key);
  return raw !== null ? JSON.parse(raw) : fallback;
}

// ═══════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════
window.onload = async function () {
  await carregarServicos();
  await carregarHorarios();
  aplicarFrase();
};

async function aplicarFrase() {
  const frase = await dbGetConfig("frase", getCfgLocal("frase", "Realçando sua beleza natural"));
  const el = document.getElementById("frase-site");
  if (el) el.textContent = frase;
}

// ─── Serviços ────────────────────────────────
async function carregarServicos() {
  const select = document.getElementById("servico");
  if (!select) return;

  const defaultServicos = [
    { nome: "Design de sobrancelha",           preco: 40  },
    { nome: "Design de sobrancelha com Henna", preco: 40  },
    { nome: "Design de unhas",                 preco: 150 },
    { nome: "Penteados",                       preco: 120 },
    { nome: "Maquiagem",                       preco: 35  }
  ];

  const servicosCompletos = await dbGetConfig("servicosCompletos", null);
  const servicos = servicosCompletos?.length
    ? servicosCompletos
    : await dbGetConfig("servicos", getCfgLocal("servicos", defaultServicos));

  select.innerHTML = servicos.map(s =>
    `<option value="${s.nome}" data-preco="${s.preco || 0}">
      ${s.nome}${s.preco ? " — R$ " + Number(s.preco).toFixed(2) : ""}
    </option>`
  ).join("");
}

// ─── Horários ────────────────────────────────
async function carregarHorarios() {
  const dataSel    = document.getElementById("data")?.value || "";
  const horaSelect = document.getElementById("hora");
  if (!horaSelect) return;

  const horariosAtivos  = await dbGetConfig("horariosAtivos",  getCfgLocal("horariosAtivos",  ["09:00","10:00","11:00","13:00","14:00","15:00"]));
  const datasBloqueadas = await dbGetConfig("datasBloqueadas", getCfgLocal("datasBloqueadas", []));

  if (dataSel && datasBloqueadas.includes(dataSel)) {
    horaSelect.innerHTML = '<option disabled selected>Esta data está indisponível</option>';
    return;
  }

  const agora = new Date();
  const hoje  = agora.toISOString().split("T")[0];

  let ocupados = [];
  if (dataSel) {
    // tenta buscar com colunas novas (reservado_ate, status)
    let rows = null;
    const { data, error } = await sb.from("agendamentos")
      .select("hora, data, status, reservado_ate")
      .eq("data", dataSel)
      .neq("status", "cancelado")
      .neq("status", "expirado");

    if (error) {
      // fallback: busca só os campos básicos se colunas novas não existirem
      const { data: data2 } = await sb.from("agendamentos")
        .select("hora, data, status")
        .eq("data", dataSel)
        .neq("status", "cancelado");
      rows = data2;
    } else {
      rows = data;
    }

    ocupados = (rows || []).filter(r => {
      const dataHora = new Date(`${r.data}T${r.hora}:00`);
      if (dataHora < agora) return false;
      if (r.status === "reservado" && r.reservado_ate) {
        return new Date(r.reservado_ate) > agora;
      }
      return true;
    }).map(r => r.hora);
  }

  const opcoes = horariosAtivos.map(h => {
    const jaPassou = dataSel === hoje && new Date(`${dataSel}T${h}:00`) < agora;
    const ocupado  = ocupados.includes(h);
    if (jaPassou) return `<option value="${h}" disabled>${h} (encerrado)</option>`;
    if (ocupado)  return `<option value="${h}" disabled>${h} (ocupado)</option>`;
    return `<option value="${h}">${h}</option>`;
  });

  horaSelect.innerHTML = opcoes.join("");

  const primeiroDisponivel = horariosAtivos.find(h => {
    const jaPassou = dataSel === hoje && new Date(`${dataSel}T${h}:00`) < agora;
    return !jaPassou && !ocupados.includes(h);
  });
  if (primeiroDisponivel) horaSelect.value = primeiroDisponivel;
}

document.addEventListener("DOMContentLoaded", () => {
  const dataInput = document.getElementById("data");
  if (dataInput) dataInput.addEventListener("change", carregarHorarios);
});

// ═══════════════════════════════════════════════
//  ETAPA 1 → 2  (reserva horário por 30 min)
// ═══════════════════════════════════════════════
async function irParaPagamento() {
  const nome      = document.getElementById("nome").value.trim();
  const telefone  = document.getElementById("telefone").value.trim();
  const servicoEl = document.getElementById("servico");
  const servico   = servicoEl.value;
  const preco     = parseFloat(servicoEl.selectedOptions[0]?.dataset.preco || 0);
  const data      = document.getElementById("data").value;
  const hora      = document.getElementById("hora").value;

  if (!nome || !telefone || !data || !hora) {
    alert("Preencha todos os campos antes de continuar.");
    return;
  }

  if (new Date(`${data}T${hora}:00`) < new Date()) {
    alert("Este horário já passou. Por favor, escolha outra data ou horário.");
    await carregarHorarios();
    return;
  }

  const conflito = await dbVerificarConflito(data, hora);
  if (conflito) {
    alert("Esse horário acabou de ser reservado por outra pessoa. Por favor, escolha outro.");
    await carregarHorarios();
    return;
  }

  // ── Reserva o horário por 30 minutos ────────
  const reservadoAte = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const ag = await dbSalvarAgendamento({
    nome,
    telefone:      normalizarTel(telefone),
    servico,
    preco,
    data,
    hora,
    status:        "reservado",
    reservado_ate: reservadoAte,
    pagamento:     null
  });

  if (!ag) {
    alert("Erro ao reservar horário. Tente novamente.");
    return;
  }

  dadosAgendamento = { id: ag.id, nome, telefone, servico, preco, data, hora };

  // monta resumo
  const dataFmt = data.split("-").reverse().join("/");
  document.getElementById("resumo").innerHTML = `
    <div class="linha-resumo"><span>Serviço</span><strong>${servico}</strong></div>
    <div class="linha-resumo"><span>Data</span><strong>${dataFmt} às ${hora}</strong></div>
    <div class="linha-resumo"><span>Nome</span><strong>${nome}</strong></div>
    ${preco ? `<div class="linha-resumo"><span>Valor total</span><strong>R$ ${preco.toFixed(2)}</strong></div>` : ""}
  `;

  const modoEntrada = await dbGetConfig("pixEntrada", getCfgLocal("pixEntrada", "opcao"));

  const pixOpcoes = document.getElementById("pix-opcoes");
  pagamentoSelecionado = null;
  document.getElementById("pix-info").style.display     = "none";
  document.getElementById("btn-ja-paguei").style.display = "none";

  if (modoEntrada === "0") {
    await confirmarSemPagamento();
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
      <div class="pix-card selecionado" id="op-50" style="grid-column:1/-1">
        <div class="check-badge" style="display:flex">✓</div>
        <div class="pix-icone">💸</div>
        <div class="pix-titulo">Entrada de 50% obrigatória</div>
        ${metade ? `<div class="pix-valor">R$ ${metade}</div>` : ""}
        <div class="pix-desc">Pague via Pix para confirmar.<br>O restante no dia do atendimento.</div>
      </div>`;
    selecionarPagamento("50");
  } else if (modoEntrada === "30") {
    const trintaPct = preco ? (preco * 0.3).toFixed(2) : null;
    pixOpcoes.innerHTML = `
      <div class="pix-card selecionado" id="op-30" style="grid-column:1/-1">
        <div class="check-badge" style="display:flex">✓</div>
        <div class="pix-icone">💸</div>
        <div class="pix-titulo">Entrada de 30% obrigatória</div>
        ${trintaPct ? `<div class="pix-valor">R$ ${trintaPct}</div>` : ""}
        <div class="pix-desc">Pague via Pix para confirmar.<br>O restante no dia do atendimento.</div>
      </div>`;
    selecionarPagamento("30");
  }

  irParaTela(2);
  iniciarContagemRegressiva(reservadoAte);
}

// ═══════════════════════════════════════════════
//  CONTAGEM REGRESSIVA — 30 min para pagar
// ═══════════════════════════════════════════════
function iniciarContagemRegressiva(reservadoAte) {
  if (contagemRegressiva) clearInterval(contagemRegressiva);
  const expira = new Date(reservadoAte).getTime();

  // torna o timer visível
  const el = document.getElementById("timer-reserva");
  if (el) el.style.display = "block";

  function atualizar() {
    const restante = expira - Date.now();
    const el = document.getElementById("timer-reserva");
    if (!el) return;

    if (restante <= 0) {
      clearInterval(contagemRegressiva);
      el.innerHTML = `⏰ Reserva expirada! O horário foi liberado. <a href="agendamento.html" style="color:#e38f7a;font-weight:600">Tente novamente</a>`;
      el.style.background = "rgba(255,100,100,0.2)";
      el.style.color = "#7a0000";
      if (dadosAgendamento.id) dbAtualizarStatus(dadosAgendamento.id, "expirado");
      document.getElementById("btn-ja-paguei").style.display = "none";
      return;
    }

    const min = Math.floor(restante / 60000);
    const seg = Math.floor((restante % 60000) / 1000);
    const urgente = restante < 5 * 60 * 1000;
    el.innerHTML  = `${urgente ? "🔴" : "⏳"} Horário reservado por <strong>${min}:${String(seg).padStart(2,"0")}</strong> — pague para confirmar`;
    el.style.background = urgente ? "rgba(255,150,50,0.25)" : "rgba(240,192,96,0.2)";
    el.style.color = urgente ? "#7a3300" : "#7a5700";
  }

  atualizar();
  contagemRegressiva = setInterval(atualizar, 1000);
}

// ═══════════════════════════════════════════════
//  SELECIONAR PAGAMENTO
// ═══════════════════════════════════════════════
async function selecionarPagamento(opcao) {
  pagamentoSelecionado = opcao;
  document.querySelectorAll(".pix-card").forEach(c => c.classList.remove("selecionado"));
  const card = document.getElementById("op-" + opcao);
  if (card) card.classList.add("selecionado");

  const preco    = dadosAgendamento.preco || 0;
  const valorPix = opcao === "50" ? preco / 2 : opcao === "30" ? preco * 0.3 : preco;
  const pixChave = await dbGetConfig("pixChave", getCfgLocal("pixChave", "yaranadiele@gmail.com"));
  const pixNome  = await dbGetConfig("pixNome",  getCfgLocal("pixNome",  "Patricia Lima"));

  document.getElementById("pix-info").style.display        = "block";
  document.getElementById("pix-nome-display").textContent  = pixNome;
  document.getElementById("pix-valor-display").textContent = valorPix ? `R$ ${valorPix.toFixed(2)}` : "—";
  document.getElementById("pix-chave-display").textContent = pixChave;
  document.getElementById("btn-ja-paguei").style.display   = "block";
}

function copiarChave() {
  const chave = document.getElementById("pix-chave-display").textContent;
  navigator.clipboard.writeText(chave).then(() => {
    const btn = document.querySelector(".btn-copiar");
    btn.textContent = "✅ Copiado!";
    setTimeout(() => { btn.textContent = "📋 Copiar"; }, 2000);
  });
}

// ═══════════════════════════════════════════════
//  "JÁ PAGUEI" — envia comprovante pelo WhatsApp
// ═══════════════════════════════════════════════
async function finalizarAgendamento() {
  if (!pagamentoSelecionado) { alert("Selecione uma opção de pagamento."); return; }
  const preco    = dadosAgendamento.preco || 0;
  const valorPago = pagamentoSelecionado === "50" ? preco / 2
                  : pagamentoSelecionado === "30" ? preco * 0.3
                  : preco;
  await enviarComprovanteWhatsapp(pagamentoSelecionado, valorPago);
}

async function enviarComprovanteWhatsapp(modoPag, valorPago) {
  const { id, nome, servico, preco, data, hora } = dadosAgendamento;
  const telefone  = normalizarTel(dadosAgendamento.telefone);
  const dataFmt   = data.split("-").reverse().join("/");
  const numeroWpp = normalizarTel(await dbGetConfig("whatsapp", getCfgLocal("whatsapp", "5582996692302")));
  const pixChave  = await dbGetConfig("pixChave", getCfgLocal("pixChave", "yaranadiele@gmail.com"));

  // muda status para aguardando_confirmacao (com fallback se coluna pix_valor não existir)
  if (id) {
    // tenta update completo
    const { error: errUpdate } = await sb.from("agendamentos").update({
      status:    "aguardando_confirmacao",
      pagamento: modoPag,
      pix_valor: valorPago
    }).eq("id", id);

    // se falhar (coluna pix_valor não existe ainda), faz update básico
    if (errUpdate) {
      await sb.from("agendamentos").update({
        status:    "aguardando_confirmacao",
        pagamento: modoPag
      }).eq("id", id);
    }

    // salva no histórico de pagamentos (silencia erro se tabela não existir)
    await sb.from("pagamentos").upsert([{
      agendamento_id: id,
      valor:          valorPago,
      status:         "aguardando_confirmacao",
      descricao:      `${servico} - ${dataFmt} às ${hora}`,
      criado_em:      new Date().toISOString()
    }], { onConflict: "agendamento_id" }).catch(e => console.warn("pagamentos:", e));
  }

  let linhaPag = "";
  if (modoPag === "total" && valorPago > 0)
    linhaPag = `\n💰 Pix enviado: R$ ${valorPago.toFixed(2)} (total)`;
  else if (modoPag === "50" && valorPago > 0)
    linhaPag = `\n💰 Pix enviado: R$ ${valorPago.toFixed(2)} (entrada 50% — restante no dia)`;
  else if (modoPag === "30" && valorPago > 0)
    linhaPag = `\n💰 Pix enviado: R$ ${valorPago.toFixed(2)} (entrada 30% — restante no dia)`;

  const mensagem =
    `Olá Patricia! 👋 Fiz o agendamento e acabei de enviar o Pix.\n\n` +
    `👤 Nome: ${nome}\n💅 Serviço: ${servico}\n📅 Data: ${dataFmt}\n🕐 Hora: ${hora}` +
    linhaPag +
    `\n📲 Chave Pix usada: ${pixChave}` +
    `\n\n📎 Segue o comprovante 👇`;

  // abre WhatsApp ANTES do await
  window.open(`https://wa.me/${numeroWpp}?text=${encodeURIComponent(mensagem)}`, "_blank");

  if (contagemRegressiva) clearInterval(contagemRegressiva);

  document.getElementById("sucesso-texto").textContent =
    `✅ Comprovante enviado para Patricia pelo WhatsApp!\n\n` +
    `${servico} — ${dataFmt} às ${hora}\n\n` +
    `⏳ Aguarde a confirmação de Patricia. Ela verificará o pagamento e confirmará seu horário.` +
    (valorPago > 0 ? `\n\n💰 Valor: R$ ${valorPago.toFixed(2)}` : "");

  irParaTela(3);
  document.getElementById("btn-voltar-inicio").style.display = "none";
}

// ── Sem pagamento exigido ────────────────────
async function confirmarSemPagamento() {
  const { id, nome, servico, data, hora } = dadosAgendamento;
  const dataFmt   = data.split("-").reverse().join("/");
  const numeroWpp = normalizarTel(await dbGetConfig("whatsapp", getCfgLocal("whatsapp", "5582996692302")));

  if (id) await dbAtualizarStatus(id, "pendente");

  const mensagem =
    `Olá Patricia! Gostaria de confirmar meu agendamento:\n\n` +
    `👤 Nome: ${nome}\n💅 Serviço: ${servico}\n📅 Data: ${dataFmt}\n🕐 Hora: ${hora}`;

  window.open(`https://wa.me/${numeroWpp}?text=${encodeURIComponent(mensagem)}`, "_blank");

  document.getElementById("sucesso-texto").textContent =
    `Agendamento enviado para Patricia! 😊\n\n${servico} — ${dataFmt} às ${hora}`;
  irParaTela(3);
  document.getElementById("btn-voltar-inicio").style.display = "none";
}

// ═══════════════════════════════════════════════
//  NAVEGAÇÃO
// ═══════════════════════════════════════════════
function irParaTela(n) {
  document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
  document.getElementById("tela-" + n).classList.add("ativa");
  [1,2,3].forEach(i => {
    const circ = document.getElementById("circ-" + i);
    const lbl  = document.getElementById("lbl-" + i);
    circ.classList.remove("ativa","feita");
    if (lbl) lbl.classList.remove("ativa");
    if (i < n)        { circ.classList.add("feita"); circ.textContent = "✓"; }
    else if (i === n) { circ.classList.add("ativa"); circ.textContent = i; if(lbl) lbl.classList.add("ativa"); }
    else              { circ.textContent = i; }
  });
  const btnVoltar = document.getElementById("btn-voltar-inicio");
  if (btnVoltar) btnVoltar.style.display = n === 3 ? "none" : "flex";
}

function voltarEtapa1() {
  // libera a reserva se o cliente desistir
  if (dadosAgendamento.id) {
    dbAtualizarStatus(dadosAgendamento.id, "cancelado");
    dadosAgendamento = {};
  }
  if (contagemRegressiva) clearInterval(contagemRegressiva);
  irParaTela(1);
}
