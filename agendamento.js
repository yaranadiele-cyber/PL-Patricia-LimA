function enviarWhatsapp(){

let nome=document.getElementById("nome").value
let servico=document.getElementById("servico").value
let data=document.getElementById("data").value
let hora=document.getElementById("hora").value

if(!nome || !data || !hora){

alert("Preencha todos os campos")
return

}

let agendamentos=JSON.parse(localStorage.getItem("agendamentos"))||[]

// verificar horário ocupado
for(let a of agendamentos){

if(a.data===data && a.hora===hora){

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

localStorage.setItem("agendamentos",JSON.stringify(agendamentos))

let telefone="5582996692302"

let mensagem=`Olá Patricia! Gostaria de agendar:

Nome: ${nome}
Serviço: ${servico}
Data: ${data}
Hora: ${hora}`

let url=`https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`

window.open(url,"_blank")

carregarHorarios()

}

function carregarHorarios(){

let data=document.getElementById("data").value
let horaSelect=document.getElementById("hora")

let agendamentos=JSON.parse(localStorage.getItem("agendamentos"))||[]

for(let option of horaSelect.options){

option.disabled=false

for(let a of agendamentos){

if(a.data===data && a.hora===option.value){

option.disabled=true

}

}

}

}

document.getElementById("data").addEventListener("change",carregarHorarios)

window.onload=carregarHorarios