function enviarWhatsapp(){

let nome=document.getElementById("nome").value
let servico=document.getElementById("servico").value
let data=document.getElementById("data").value
let hora=document.getElementById("hora").value

let agendamentos=JSON.parse(localStorage.getItem("agendamentos"))||[]

agendamentos.push({nome,servico,data,hora})

localStorage.setItem("agendamentos",JSON.stringify(agendamentos))

let telefone="5582996692302"

let msg=`Olá Patricia! Gostaria de agendar:

Nome: ${nome}
Serviço: ${servico}
Data: ${data}
Hora: ${hora}`

let url=`https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`

window.open(url,"_blank")

}