function enviarWhatsapp(){

let nome = document.getElementById("nome").value
let data = document.getElementById("data").value
let hora = document.getElementById("hora").value
let servico = document.getElementById("servico").value

let numero = "5582996692302" // coloque seu numero

let mensagem = `Olá Patricia, gostaria de agendar um horário.

Nome: ${nome}
Serviço: ${servico}
Data: ${data}
Horário: ${hora}`

let url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`

window.open(url,"_blank")

}