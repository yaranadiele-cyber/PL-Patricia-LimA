function carregarHorarios(){

let data = document.getElementById("data").value

let ocupados = JSON.parse(localStorage.getItem("agenda_"+data)) || []

let select = document.getElementById("hora")

for(let option of select.options){

if(ocupados.includes(option.value)){

option.classList.add("ocupado")
option.disabled = true

}else{

option.classList.remove("ocupado")
option.disabled = false

}

}

}

document.getElementById("data").addEventListener("change",carregarHorarios)

function enviarWhatsapp(){

let nome = document.getElementById("nome").value
let servico = document.getElementById("servico").value
let data = document.getElementById("data").value
let hora = document.getElementById("hora").value

if(!nome || !data){

alert("Preencha nome e data")

return

}

let ocupados = JSON.parse(localStorage.getItem("agenda_"+data)) || []

if(ocupados.includes(hora)){

alert("Esse horário já foi reservado")

return

}

ocupados.push(hora)

localStorage.setItem("agenda_"+data, JSON.stringify(ocupados))

let mensagem = `Olá Patricia! Gostaria de agendar.

Nome: ${nome}
Serviço: ${servico}
Data: ${data}
Hora: ${hora}`

let telefone = "5582996692302"

let url = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`

window.open(url,"_blank")

carregarHorarios()

}

window.onload = carregarHorarios