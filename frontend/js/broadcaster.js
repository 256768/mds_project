const playerElement = document.getElementById('hlsPlayer');
const loginCardElement = document.getElementById('loginCard');
const broadcastGroupElement = document.getElementById('broadcastGroup');
const broadcasterNameElement = document.getElementById('broadcasterName');
const microphoneStateElement = document.getElementById('microphoneState');
const unmuteButtonElement = document.getElementById('unmuteButton');
const muteButtonElement = document.getElementById('muteButton');

// do elementu playerElement prida funkcionalitu knihovny Video.js
var options = {
    fluid: true, //meni se velikost dle okna
    loop: true,
    muted: true,
    autoplay: true
};
var player = videojs(playerElement, options);
player.play();

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

function getWebcamAndMicrophone(el,config, onPlaying){
    //check for webcams (or other video devices)
    const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

    if(hasGetUserMedia()){
        // only run's once, and passes the stream, to the video element
        navigator.mediaDevices.getUserMedia(config).then(function(stream) {
            if(!el)
                return
            el.srcObject = stream;
            console.log(stream);
            el.play();
            onPlaying()
        })
        .catch(function(err) {
            console.log("Nastala chyba " + err);//(this error gets reached instead)
        });
    }else{
        console.log("Webkamera nenalezena");//this error cannot be reached
    }
}

function testWebcam(){
    getWebcamAndMicrophone(player.tech().el(), { video: true, audio: true }, () => {
        streaming = true;
        console.log("Webkamera je v náhledu")
    });
}