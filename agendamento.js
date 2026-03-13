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