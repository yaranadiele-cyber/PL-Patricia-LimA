const slides = document.querySelectorAll(".slide")

let index = 0

function atualizar(){

slides.forEach(slide=>{
slide.classList.remove("active","left","right")
})

slides[index].classList.add("active")

let esquerda = index - 1
let direita = index + 1

if(esquerda < 0){
esquerda = slides.length - 1
}

if(direita >= slides.length){
direita = 0
}

slides[esquerda].classList.add("left")
slides[direita].classList.add("right")

}

function proximo(){

index++

if(index >= slides.length){
index = 0
}

atualizar()

}

/* troca a cada 3 segundos */

setInterval(proximo,3000)

/* inicia carrossel */

atualizar()
