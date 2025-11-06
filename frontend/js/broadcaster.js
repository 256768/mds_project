const loginCardElement = document.getElementById('loginCard');
const broadcastGroupElement = document.getElementById('broadcastGroup');
const broadcasterNameElement = document.getElementById('broadcasterName');
const microphoneStateElement = document.getElementById('microphoneState');
const unmuteButtonElement = document.getElementById('unmuteButton');
const muteButtonElement = document.getElementById('muteButton');

function login(){
    loginCardElement.style.display = 'none';
    broadcastGroupElement.style.removeProperty('display');
}

function logout(){
    loginCardElement.style.removeProperty('display');
    broadcastGroupElement.style.display = 'none';
}

function setName(){
    
}

function muteMicrophone(){
    microphoneStateElement.innerHTML = "Mikrofon je ztlumený"
    unmuteButtonElement.style.removeProperty('display');
    muteButtonElement.style.display = 'none';
}

function unmuteMicrophone(){
    microphoneStateElement.innerHTML = "Mikrofon je zapnutý"
    unmuteButtonElement.style.display = 'none';
    muteButtonElement.style.removeProperty('display');
}

logout();
muteMicrophone();