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

for(let a of agendamentos){

if(a.data === data && a.hora === hora){

alert("Esse horário já está ocupado")

return

}

}

agendamentos.push({

nome:nome,
servico:servico,
data:data,
hora:hora

})

localStorage.setItem("agendamentos",JSON.stringify(agendamentos))

let telefone="5582996692302"

let mensagem=`Olá Patricia! Gostaria de agendar.

Nome: ${nome}
Serviço: ${servico}
Data: ${data}
Hora: ${hora}`

let url=`https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`

window.open(url,"_blank")

}