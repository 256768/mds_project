const playerElement = document.getElementById('webcamPreview');
const loginCardElement = document.getElementById('loginCard');
const loginFormElement = document.getElementById('loginForm');
const broadcastGroupElement = document.getElementById('broadcastGroup');
const broadcasterNameElement = document.getElementById('broadcasterName');
const microphoneStateElement = document.getElementById('microphoneState');
const unmuteButtonElement = document.getElementById('unmuteButton');
const muteButtonElement = document.getElementById('muteButton');
const streamStateElement = document.getElementById('streamState');
const startButtonElement = document.getElementById('startButton');
const stopButtonElement = document.getElementById('stopButton');
const controlsElement = document.getElementById('controls');
const errorDialogElement = document.getElementById('errorDialog');
const errorNameElement = document.getElementById('errorName');

// cookies
function setCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}
function eraseCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

var ws;
var mediaRecorder;
var token = getCookie("token");
var currentStream; // uložíme si stream z getUserMedia

// video.js player
var options = {
    fluid: true,
    loop: true,
    muted: true,
    autoplay: true
};
var player = videojs(playerElement, options);
player.play();

// login
loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = loginFormElement.password.value;

    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include'
    });
    const data = await res.json();

    if(res.ok){
        token = data.token;
        setCookie("token", token, 1);
        login();
    }else{
        alert('Špatné heslo');
        loginFormElement.reset();
    }
});

function login(){
    loginCardElement.style.display = 'none';
    broadcastGroupElement.style.removeProperty('display');
    getWebcamAndMicrophone();
}

function logout(){
    loginCardElement.style.removeProperty('display');
    broadcastGroupElement.style.display = 'none';
    eraseCookie("token");
}

function setName(){
    if(streamStateElement.innerHTML == "Vysílání je spuštěné"){
        stopStream();
        startStream();
    }
}

function muteMicrophone(){
    microphoneStateElement.innerHTML = "Mikrofon je ztlumený";
    unmuteButtonElement.style.removeProperty('display');
    muteButtonElement.style.display = 'none';

    if(currentStream){
        currentStream.getAudioTracks().forEach(track => track.enabled = false);
    }
}

function unmuteMicrophone(){
    microphoneStateElement.innerHTML = "Mikrofon je zapnutý";
    unmuteButtonElement.style.display = 'none';
    muteButtonElement.style.removeProperty('display');

    if(currentStream){
        currentStream.getAudioTracks().forEach(track => track.enabled = true);
    }
}

function startStream(){
    if(broadcasterNameElement.value == ""){
        alert("Je třeba nastavit jméno");
        return;
    }
    window.ws = new WebSocket('ws://localhost:3000/broadcast?name=' + broadcasterNameElement.value + "&token=" + token);
    window.ws.binaryType = 'arraybuffer';
    window.ws.onopen = () => {
        // MIME typ fallback
        let options = { mimeType: 'video/webm;codecs=vp8,opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm' };
        }

        window.mediaRecorder = new MediaRecorder(currentStream, options);
        window.mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0 && window.ws.readyState === WebSocket.OPEN) {
                window.ws.send(e.data);
            }
        };
        window.mediaRecorder.start(200);

        muteButtonElement.disabled = false;
        streamStateElement.innerHTML = "Vysílání je spuštěné";
        startButtonElement.style.display = 'none';
        stopButtonElement.style.removeProperty('display');
    };
    window.ws.onerror = function (error) {
        alert("Vysílání se nepodařilo zahájit");
        console.log(error);
    };
}

function stopStream(){
    streamStateElement.innerHTML = "Vysílání je zastavené";
    startButtonElement.style.removeProperty('display');
    stopButtonElement.style.display = 'none';

    if(window.mediaRecorder){
        window.mediaRecorder.stop();
    }
    if(window.ws){
        window.ws.close();
    }
}

function getWebcamAndMicrophone(){
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(function(stream) {
        currentStream = stream;
        player.tech().el().srcObject = stream;
        player.tech().el().play();
        console.log("Webkamera je v náhledu");
    })
    .catch(function(err) {
        console.log("Nastala chyba " + err);
        showError(err);
    });
}

function showError(e){
    let error;
    switch(e.name){
        case "NotFoundError":
            error = "webkamera a mikrofon nebyly nalezeny";
            break;
        case "NotAllowedError":
            error = "nebyl umožněn přístup ke kameře a mikrofonu";
            break;
        default:
            error = e;
            break;
    }
    alert("Nastala chyba: "+error);
    errorNameElement.innerHTML = error;
    errorDialogElement.style.removeProperty('display');
    controlsElement.style.display = 'none';
}

// init
if(getCookie("token") != null){
    login();
}else{
    logout();
}

unmuteMicrophone();
stopStream();
