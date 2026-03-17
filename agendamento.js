// Normaliza número de telefone para o formato internacional brasileiro (55 + DDD + número)
function normalizarTel(tel) {
  let t = (tel || "").replace(/\D/g, ""); // remove tudo que não é número
  if (!t) return "";

  // Já está completo com código do país: 55 + DDD(2) + número(8 ou 9) = 12 ou 13 dígitos
  if (t.startsWith("55") && (t.length === 12 || t.length === 13)) return t;

  // Tem DDD + número sem o 55: 10 ou 11 dígitos → adiciona 55
  if (t.length === 10 || t.length === 11) return "55" + t;

  // Só o número sem DDD: 8 ou 9 dígitos → adiciona 55 + DDD padrão 82 (Alagoas)
  if (t.length === 8 || t.length === 9) return "5582" + t;

  // Qualquer outro caso: tenta adicionar 55
  return "55" + t;
}

// ═══════════════════════════════════════════════
//  ESTADO GLOBAL
// ═══════════════════════════════════════════════
let dadosAgendamento = {};
let pagamentoSelecionado = null;

// fallback local (caso Supabase demore)
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
  aplicarFotosCarrossel();
};

async function aplicarFrase() {
  const frase = await dbGetConfig("frase", getCfgLocal("frase", "Realçando sua beleza natural"));
  const el = document.getElementById("frase-site");
  if (el) el.textContent = frase;
}

function aplicarFotosCarrossel() {
  const fotos = JSON.parse(localStorage.getItem("carrossel_fotos") || "[]");
  if (!fotos.length) return;
  const galeria = document.querySelector(".galeria");
  if (!galeria) return;
  galeria.innerHTML = fotos.map((f, i) =>
    `<img src="${f.src}" class="slide${i === 0 ? " active" : ""}">`
  ).join("");
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

  const servicos = await dbGetConfig("servicos", getCfgLocal("servicos", defaultServicos));

  select.innerHTML = servicos.map(s =>
    `<option value="${s.nome}" data-preco="${s.preco}">
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

  // busca horários ocupados no banco
  let ocupados = [];
  if (dataSel) {
    const { data } = await sb.from("agendamentos")
      .select("hora")
      .eq("data", dataSel)
      .neq("status", "cancelado");
    ocupados = (data || []).map(r => r.hora);
  }

  horaSelect.innerHTML = horariosAtivos.map(h => {
    const ocupado = ocupados.includes(h);
    return `<option value="${h}" ${ocupado ? "disabled" : ""}>${h}${ocupado ? " (ocupado)" : ""}</option>`;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const dataInput = document.getElementById("data");
  if (dataInput) dataInput.addEventListener("change", carregarHorarios);
});

// ═══════════════════════════════════════════════
//  ETAPA 1 → 2
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

  // verifica conflito no banco
  const conflito = await dbVerificarConflito(data, hora);
  if (conflito) {
    alert("Esse horário já está ocupado. Por favor, escolha outro.");
    await carregarHorarios();
    return;
  }

  dadosAgendamento = { nome, telefone, servico, preco, data, hora };

  const modoEntrada = await dbGetConfig("pixEntrada", getCfgLocal("pixEntrada", "opcao"));

  if (modoEntrada === "0") {
    await salvarEEnviarWhatsapp("total", preco);
    return;
  }

  // monta resumo
  const dataFmt = data.split("-").reverse().join("/");
  document.getElementById("resumo").innerHTML = `
    <div class="linha-resumo"><span>Serviço</span><strong>${servico}</strong></div>
    <div class="linha-resumo"><span>Data</span><strong>${dataFmt} às ${hora}</strong></div>
    <div class="linha-resumo"><span>Nome</span><strong>${nome}</strong></div>
    ${preco ? `<div class="linha-resumo"><span>Valor total</span><strong>R$ ${preco.toFixed(2)}</strong></div>` : ""}
  `;

  const pixOpcoes = document.getElementById("pix-opcoes");
  pagamentoSelecionado = null;
  document.getElementById("pix-info").style.display    = "none";
  document.getElementById("btn-ja-paguei").style.display = "none";

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
      </div>
    `;
  } else if (modoEntrada === "50") {
    const metade = preco ? (preco / 2).toFixed(2) : null;
    pixOpcoes.innerHTML = `
      <div class="pix-card" id="op-50" style="grid-column:1/-1">
        <div class="check-badge">✓</div>
        <div class="pix-icone">💸</div>
        <div class="pix-titulo">Entrada de 50% obrigatória</div>
        ${metade ? `<div class="pix-valor">R$ ${metade}</div>` : ""}
        <div class="pix-desc">Pague a entrada via Pix para confirmar.<br>O restante no dia do atendimento.</div>
      </div>
    `;
    selecionarPagamento("50");
  } else if (modoEntrada === "30") {
    const trintaPct = preco ? (preco * 0.3).toFixed(2) : null;
    pixOpcoes.innerHTML = `
      <div class="pix-card" id="op-30" style="grid-column:1/-1">
        <div class="check-badge">✓</div>
        <div class="pix-icone">💸</div>
        <div class="pix-titulo">Entrada de 30% obrigatória</div>
        ${trintaPct ? `<div class="pix-valor">R$ ${trintaPct}</div>` : ""}
        <div class="pix-desc">Pague a entrada via Pix para confirmar.<br>O restante no dia do atendimento.</div>
      </div>
    `;
    selecionarPagamento("30");
  }

  irParaTela(2);
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
  const pixChave = await dbGetConfig("pixChave", getCfgLocal("pixChave", ""));
  const pixNome  = await dbGetConfig("pixNome",  getCfgLocal("pixNome",  "Patricia Lima"));

  let valorPix = opcao === "50" ? preco / 2 : opcao === "30" ? preco * 0.3 : preco;

  document.getElementById("pix-info").style.display      = "block";
  document.getElementById("pix-nome-display").textContent = pixNome;
  document.getElementById("pix-valor-display").textContent = valorPix ? `R$ ${valorPix.toFixed(2)}` : "—";
  document.getElementById("pix-chave-display").textContent = pixChave || "Chave não configurada — contate a profissional";
  document.getElementById("btn-ja-paguei").style.display  = "block";
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
//  FINALIZAR
// ═══════════════════════════════════════════════
async function finalizarAgendamento() {
  if (!pagamentoSelecionado) { alert("Selecione uma opção de pagamento."); return; }
  const preco = dadosAgendamento.preco || 0;
  let valorPago = pagamentoSelecionado === "50" ? preco / 2 : pagamentoSelecionado === "30" ? preco * 0.3 : preco;
  await salvarEEnviarWhatsapp(pagamentoSelecionado, valorPago);
}

async function salvarEEnviarWhatsapp(modoPag, valorPago) {
  const { nome, servico, preco, data, hora } = dadosAgendamento;
  // normaliza o telefone do cliente para salvar limpo no banco
  const telefone = normalizarTel(dadosAgendamento.telefone);

  const dataFmt   = data.split("-").reverse().join("/");
  const numeroWppRaw = await dbGetConfig("whatsapp", getCfgLocal("whatsapp", "5582996692302"));
  const numeroWpp = normalizarTel(numeroWppRaw);

  let linhaPagamento = "";
  if (modoPag === "total" && valorPago > 0)
    linhaPagamento = `\nPagamento: Total via Pix (R$ ${valorPago.toFixed(2)})`;
  else if (modoPag === "50" && valorPago > 0)
    linhaPagamento = `\nPagamento: Entrada 50% via Pix (R$ ${valorPago.toFixed(2)}) — restante no dia`;
  else if (modoPag === "30" && valorPago > 0)
    linhaPagamento = `\nPagamento: Entrada 30% via Pix (R$ ${valorPago.toFixed(2)}) — restante no dia`;

  const mensagem =
    `Olá Patricia! Gostaria de agendar:\n\n` +
    `Nome: ${nome}\nServiço: ${servico}\nData: ${dataFmt}\nHora: ${hora}` +
    linhaPagamento;

  // ⚠️ Abre o WhatsApp ANTES do await para não ser bloqueado pelo navegador
  window.open(`https://wa.me/${numeroWpp}?text=${encodeURIComponent(mensagem)}`, "_blank");

  // salva no Supabase depois de abrir o WhatsApp
  const ag = await dbSalvarAgendamento({ nome, telefone, servico, preco, data, hora, status: "pendente", pagamento: modoPag });
  if (!ag) {
    console.warn("Aviso: agendamento pode não ter sido salvo no banco.");
  }

  const txt = `Seu agendamento foi enviado para Patricia pelo WhatsApp! 😊\n\n${servico} — ${dataFmt} às ${hora}` +
    (valorPago > 0 ? `\n\nLembre-se de enviar o comprovante do Pix de R$ ${valorPago.toFixed(2)}.` : "");
  document.getElementById("sucesso-texto").textContent = txt;
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
    if (i < n)       { circ.classList.add("feita"); circ.textContent = "✓"; }
    else if (i === n) { circ.classList.add("ativa"); circ.textContent = i; if(lbl) lbl.classList.add("ativa"); }
    else              { circ.textContent = i; }
  });
  const btnVoltar = document.getElementById("btn-voltar-inicio");
  if (btnVoltar) btnVoltar.style.display = n === 3 ? "none" : "flex";
}

function voltarEtapa1() { irParaTela(1); }
