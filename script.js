// ─── Carrossel ───────────────────────────────────────────────
// Tenta carregar fotos salvas no painel admin.
// Se não houver nenhuma, mantém as imagens originais do HTML.

(function aplicarFotosDoAdmin() {
  const fotos = JSON.parse(localStorage.getItem("carrossel_fotos") || "[]");
  if (!fotos.length) return;

  const galeria = document.querySelector(".galeria");
  if (!galeria) return;

  galeria.innerHTML = fotos.map((f, i) =>
    `<img src="${f.src}" class="slide${i === 0 ? " active" : ""}"
          onerror="this.style.display='none'">`
  ).join("");
})();

// ─── Lógica do carrossel ─────────────────────────────────────
const slides = document.querySelectorAll(".slide");
let index = 0;

function atualizar() {
  slides.forEach(slide => slide.classList.remove("active", "left", "right"));

  slides[index].classList.add("active");

  let esquerda = index - 1;
  let direita  = index + 1;

  if (esquerda < 0)             esquerda = slides.length - 1;
  if (direita >= slides.length) direita  = 0;

  slides[esquerda].classList.add("left");
  slides[direita].classList.add("right");
}

function proximo() {
  index++;
  if (index >= slides.length) index = 0;
  atualizar();
}

setInterval(proximo, 3000);
atualizar();
