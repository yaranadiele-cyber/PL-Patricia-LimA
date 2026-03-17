// ═══════════════════════════════════════════════
//  CARROSSEL — carrega do Supabase
//  Funciona igual em qualquer dispositivo
// ═══════════════════════════════════════════════

let slides = [];
let index  = 0;
let autoInterval = null;

async function iniciarCarrossel() {
  const galeria = document.querySelector(".galeria");
  if (!galeria) return;

  let fotos = [];
  try {
    fotos = await dbGetConfig("carrosselFotos", []);
  } catch (e) {
    console.warn("Supabase indisponível, usando fallback local");
  }

  // fallback offline: localStorage
  if (!fotos || !fotos.length) {
    fotos = JSON.parse(localStorage.getItem("carrossel_fotos") || "[]");
  }

  if (fotos.length) {
    galeria.innerHTML = fotos.map((f, i) =>
      `<img src="${f.src}" class="slide${i === 0 ? " active" : ""}" onerror="this.style.display='none'">`
    ).join("");
  }
  // sem fotos no banco = mantém imagens originais do HTML

  slides = [...document.querySelectorAll(".slide")];
  if (!slides.length) return;

  index = 0;
  atualizar();
  if (autoInterval) clearInterval(autoInterval);
  autoInterval = setInterval(proximo, 3000);
}

function atualizar() {
  slides.forEach(s => s.classList.remove("active", "left", "right"));
  if (!slides[index]) return;
  slides[index].classList.add("active");
  const esq = (index - 1 + slides.length) % slides.length;
  const dir  = (index + 1) % slides.length;
  slides[esq].classList.add("left");
  slides[dir].classList.add("right");
}

function proximo() {
  index = (index + 1) % slides.length;
  atualizar();
}

document.addEventListener("DOMContentLoaded", () => {
  iniciarCarrossel();
});
