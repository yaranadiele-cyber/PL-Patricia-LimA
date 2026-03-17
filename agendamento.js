// ═══════════════════════════════════════════════
//  HELPERS DE CONFIG
// ═══════════════════════════════════════════════
function getCfg(key, fallback) {
  const raw = localStorage.getItem("cfg_" + key);
  return raw !== null ? JSON.parse(raw) : fallback;
}

// ═══════════════════════════════════════════════
//  ESTADO GLOBAL
// ═══════════════════════════════════════════════
let dadosAgendamento = {};
let pagamentoSelecionado = null; // "50" ou "total"

// ═══════════════════════════════════════════════
//  CARREGAMENTO INICIAL
// ═══════════════════════════════════════════════
window.onload = function () {
  carregarServicos();
  carregarHorarios();
  aplicarFrase();
  aplicarFotosCarrossel();
};

function aplicarFrase() {
  const frase = getCfg("frase", null);
  if (frase) {
    const el = document.getElementById("frase-site");
    if (el) el.textContent = frase;
  }
}

// Aplica fotos do carrossel salvas no painel (se existirem)
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
function carregarServicos() {
  const select = document.getElementById("servico");
  if (!select) return;
  const servicos = getCfg("servicos", [
    { nome: "Design de sobrancelha",           preco: 40  },
    { nome: "Design de sobrancelha com Henna", preco: 40  },
    { nome: "Design de unhas",                 preco: 150 },
    { nome: "Penteados",                       preco: 120 },
    { nome: "Maquiagem",                       preco: 35  }
  ]);
  select.innerHTML = servicos.map(s =>
    `<option value="${s.nome}" data-preco="${s.preco}">
      ${s.nome}${s.preco ? " — R$ " + Number(s.preco).toFixed(2) : ""}
    </option>`
  ).join("");
}

// ─── Horários ────────────────────────────────
function carregarHorarios() {
  const dataSel    = document.getElementById("data") ? document.getElementById("data").value : "";
  const horaSelect = document.getElementById("hora");
  if (!horaSelect) return;

  const horariosAtivos  = getCfg("horariosAtivos",  ["09:00","10:00","11:00","13:00","14:00","15:00"]);
  const datasBloqueadas = getCfg("datasBloqueadas", []);
  const agendamentos    = JSON.parse(localStorage.getItem("agendamentos") || "[]");

  if (dataSel && datasBloqueadas.includes(dataSel)) {
    horaSelect.innerHTML = '<option disabled selected>Esta data está indisponível</option>';
    return;
  }

  horaSelect.innerHTML = horariosAtivos.map(h => {
    const ocupado = agendamentos.some(a => a.data === dataSel && a.hora === h);
    return `<option value="${h}" ${ocupado ? "disabled" : ""}>${h}${ocupado ? " (ocupado)" : ""}</option>`;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const dataInput = document.getElementById("data");
  if (dataInput) dataInput.addEventListener("change", carregarHorarios);
});

// ═══════════════════════════════════════════════
//  ETAPA 1 → 2 : VALIDAR E IR PARA PAGAMENTO
// ═══════════════════════════════════════════════
function irParaPagamento() {
  const nome     = document.getElementById("nome").value.trim();
  const telefone = document.getElementById("telefone").value.trim();
  const servicoEl= document.getElementById("servico");
  const servico  = servicoEl.value;
  const preco    = parseFloat(servicoEl.selectedOptions[0]?.dataset.preco || 0);
  const data     = document.getElementById("data").value;
  const hora     = document.getElementById("hora").value;

  if (!nome || !telefone || !data || !hora) {
    alert("Preencha todos os campos antes de continuar.");
    return;
  }

  // Verifica conflito
  const agendamentos = JSON.parse(localStorage.getItem("agendamentos") || "[]");
  if (agendamentos.some(a => a.data === data && a.hora === hora)) {
    alert("Esse horário já está ocupado. Por favor, escolha outro.");
    return;
  }

  dadosAgendamento = { nome, telefone, servico, preco, data, hora };

  const modoEntrada = getCfg("pixEntrada", "opcao");

  // Se não exige entrada, pula direto para finalizar
  if (modoEntrada === "0") {
    salvarEEnviarWhatsapp("total", preco);
    return;
  }

  // Monta o resumo
  const dataFmt = data.split("-").reverse().join("/");
  document.getElementById("resumo").innerHTML = `
    <div class="linha-resumo"><span>Serviço</span><strong>${servico}</strong></div>
    <div class="linha-resumo"><span>Data</span><strong>${dataFmt} às ${hora}</strong></div>
    <div class="linha-resumo"><span>Nome</span><strong>${nome}</strong></div>
    ${preco ? `<div class="linha-resumo"><span>Valor total</span><strong>R$ ${preco.toFixed(2)}</strong></div>` : ""}
  `;

  // Monta as opções de pagamento
  const pixOpcoes = document.getElementById("pix-opcoes");
  pagamentoSelecionado = null;
  document.getElementById("pix-info").style.display = "none";
  document.getElementById("btn-ja-paguei").style.display = "none";

  if (modoEntrada === "opcao") {
    // cliente escolhe
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
      <div class="pix-card selecionado" id="op-50" onclick="selecionarPagamento('50')" style="grid-column:1/-1">
        <div class="check-badge" style="display:flex">✓</div>
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
      <div class="pix-card selecionado" id="op-30" onclick="selecionarPagamento('30')" style="grid-column:1/-1">
        <div class="check-badge" style="display:flex">✓</div>
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
//  SELECIONAR OPÇÃO DE PAGAMENTO
// ═══════════════════════════════════════════════
function selecionarPagamento(opcao) {
  pagamentoSelecionado = opcao;

  // remove seleção anterior
  document.querySelectorAll(".pix-card").forEach(c => c.classList.remove("selecionado"));
  const card = document.getElementById("op-" + opcao);
  if (card) card.classList.add("selecionado");

  const preco    = dadosAgendamento.preco || 0;
  const pixChave = getCfg("pixChave", "");
  const pixNome  = getCfg("pixNome",  "Patricia Lima");

  let valorPix = 0;
  if (opcao === "50")    valorPix = preco / 2;
  else if (opcao === "30") valorPix = preco * 0.3;
  else                   valorPix = preco;

  // Mostra o bloco de informações Pix
  const infoBox = document.getElementById("pix-info");
  infoBox.style.display = "block";

  document.getElementById("pix-nome-display").textContent  = pixNome;
  document.getElementById("pix-valor-display").textContent  = valorPix ? `R$ ${valorPix.toFixed(2)}` : "—";
  document.getElementById("pix-chave-display").textContent  = pixChave || "Chave não configurada — contate a profissional";

  document.getElementById("btn-ja-paguei").style.display = "block";
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
//  FINALIZAR: SALVAR E ABRIR WHATSAPP
// ═══════════════════════════════════════════════
function finalizarAgendamento() {
  if (!pagamentoSelecionado) {
    alert("Selecione uma opção de pagamento.");
    return;
  }
  const preco = dadosAgendamento.preco || 0;
  let valorPago = 0;
  if (pagamentoSelecionado === "50")    valorPago = preco / 2;
  else if (pagamentoSelecionado === "30") valorPago = preco * 0.3;
  else                                   valorPago = preco;

  salvarEEnviarWhatsapp(pagamentoSelecionado, valorPago);
}

function salvarEEnviarWhatsapp(modoPag, valorPago) {
  const { nome, telefone, servico, preco, data, hora } = dadosAgendamento;

  // Salva o agendamento
  const agendamentos = JSON.parse(localStorage.getItem("agendamentos") || "[]");
  agendamentos.push({ nome, telefone, servico, preco, data, hora, status: "pendente", pagamento: modoPag });
  localStorage.setItem("agendamentos", JSON.stringify(agendamentos));

  const dataFmt = data.split("-").reverse().join("/");
  const numeroWpp = getCfg("whatsapp", "5582996692302");

  // Monta mensagem
  let linhaPagamento = "";
  if (modoPag === "total" && valorPago > 0) {
    linhaPagamento = `\nPagamento: Total via Pix (R$ ${valorPago.toFixed(2)})`;
  } else if (modoPag === "50" && valorPago > 0) {
    linhaPagamento = `\nPagamento: Entrada de 50% via Pix (R$ ${valorPago.toFixed(2)}) — restante no dia`;
  } else if (modoPag === "30" && valorPago > 0) {
    linhaPagamento = `\nPagamento: Entrada de 30% via Pix (R$ ${valorPago.toFixed(2)}) — restante no dia`;
  }

  const mensagem =
    `Olá Patricia! Gostaria de agendar:\n\n` +
    `Nome: ${nome}\n` +
    `Serviço: ${servico}\n` +
    `Data: ${dataFmt}\n` +
    `Hora: ${hora}` +
    linhaPagamento;

  window.open(`https://wa.me/${numeroWpp}?text=${encodeURIComponent(mensagem)}`, "_blank");

  // Exibe tela de sucesso
  const txtSucesso = `Seu agendamento foi enviado para Patricia pelo WhatsApp! 😊\n\n` +
    `${servico} — ${dataFmt} às ${hora}` +
    (valorPago > 0 ? `\n\nLembre-se de enviar o comprovante do Pix de R$ ${valorPago.toFixed(2)}.` : "");
  document.getElementById("sucesso-texto").textContent = txtSucesso;

  irParaTela(3);
  document.getElementById("btn-voltar-inicio").style.display = "none";
}

// ═══════════════════════════════════════════════
//  NAVEGAÇÃO ENTRE TELAS
// ═══════════════════════════════════════════════
function irParaTela(n) {
  document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
  document.getElementById("tela-" + n).classList.add("ativa");

  // atualiza indicador de etapas
  [1, 2, 3].forEach(i => {
    const circ = document.getElementById("circ-" + i);
    const lbl  = document.getElementById("lbl-" + i) || circ.nextElementSibling;
    circ.classList.remove("ativa", "feita");
    if (lbl) lbl.classList.remove("ativa");
    if (i < n) { circ.classList.add("feita"); circ.textContent = "✓"; }
    else if (i === n) {
      circ.classList.add("ativa");
      circ.textContent = i;
      if (lbl) lbl.classList.add("ativa");
    } else {
      circ.textContent = i;
    }
  });

  // esconde botão voltar no sucesso
  const btnVoltar = document.getElementById("btn-voltar-inicio");
  if (btnVoltar) btnVoltar.style.display = n === 3 ? "none" : "flex";
}

function voltarEtapa1() { irParaTela(1); }
