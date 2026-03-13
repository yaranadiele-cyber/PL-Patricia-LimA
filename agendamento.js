// carregar horários ocupados

function carregarHorarios(){

let data = document.getElementById("data").value
let horaSelect = document.getElementById("hora")

if(!data) return

let agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || []

for(let option of horaSelect.options){

option.disabled = false
option.style.background = "#9be2a9"

for(let a of agendamentos){

if(a.data === data && a.hora === option.value){

option.disabled = true
option.style.background = "#ff7b7b"

}

}

}

}

document.getElementById("data").addEventListener("change", carregarHorarios)



// enviar agendamento

function enviarWhatsapp(){

let nome = document.getElementById("nome").value
let servico = document.getElementById("servico").value
let data = document.getElementById("data").value
let hora = document.getElementById("hora").value

if(!nome || !data){

alert("Preencha seu nome e a data")
return

}

let agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || []

// verificar horário ocupado

for(let a of agendamentos){

if(a.data === data && a.hora === hora){

alert("Esse horário já está ocupado")
return

}

}

// salvar agendamento

agendamentos.push({

nome:nome,
servico:servico,
data:data,
hora:hora

})

localStorage.setItem("agendamentos", JSON.stringify(agendamentos))

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