const playerElement = document.getElementById('hlsPlayer');
const playerContainerElement = document.getElementById('playerContainer');
const stoppedTextElement = document.getElementById('broadcastStoppedText');
const infoElement = document.getElementById('broadcastInfo');
const infoTableElement = document.getElementById('broadcastInfoTable');
const playerCardElement = document.getElementById('playerCard');
const infoCardElement = document.getElementById('infoCard');

// do elementu playerElement prida funkcionalitu knihovny Video.js
var options = {
    fluid: true, //meni se velikost dle okna
    loop: true,
    muted: true,
    autoplay: true,
    controls: true
        /*controlBar: {
            playToggle: true,
            volumePanel: false,
            pictureInPictureToggle: false,
            progressControl: {
              seekBar: true,
            },
            currentTimeDisplay: true,
            timeDivider: true,
            durationDisplay: true,
            remainingTimeDisplay: true,
            playbackRateMenuButton: false,
          },
          preload: "auto",
          aspectRatio: "16:9",
          responsive: true,
          liveui: true*/
};
var player = videojs(playerElement, options);

player.hlsQualitySelector({
    displayCurrentQuality: true,
});

player.play();

function webcastBegin(){
  player.src({
    type: "application/x-mpegURL",
    src: "/hls/stream.m3u8"
  });

  player.controls(true);
  player.muted(false);
  infoElement.style.display = 'block';
  stoppedTextElement.style.display = 'none';
}

function webcastWait(){
  player.src({
    type: "video/mp4",
    src: "assets/waiting.mp4"
  });

  player.controls(false);
  player.muted(true);
  infoElement.style.display = 'none';
  stoppedTextElement.style.display = 'block';
}

function getBroadcasters(array){
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "/stats");

  xhr.responseType = "document";
  xhr.overrideMimeType("text/xml");

  xhr.onload = () => {
    if (xhr.readyState === xhr.DONE && xhr.status === 200) {
      array.length = 0
      const stats = xhr.responseXML;
      const applications = stats.querySelector("rtmp").querySelector("server").querySelectorAll("application");

      applications.forEach(element => {
        const name = element.querySelector("name").textContent;
        if(name == "broadcasters"){
          const streams = element.querySelector("live").querySelectorAll("stream");
          streams.forEach(stream => {
            const streamerName = stream.querySelector("name").textContent;
            const active = stream.querySelector("active");
            if(active != null){
              array.push(streamerName);
            }
          });

          return true;
        }
      });
    }
    return false;
  };

  xhr.ontimeout = (e) => {
    return false;
  };

  xhr.send();
}

function updateInfo(){
  infoTableElement.innerHTML = "<tr>";
  broadcasters.forEach(broadcaster => {
    infoTableElement.innerHTML += "<td>"+broadcaster+"</td>";
  });
  infoTableElement.innerHTML += "</tr>";
}

//check if stream running
var broadcasters = [];
function isRunning(){
  getBroadcasters(broadcasters);
  console.log(broadcasters, broadcasters.length);
  if(broadcasters.length == 0){
    if(stoppedTextElement.style.display != "block"){
      webcastWait();
    }
  }else{
    updateInfo();
    if(stoppedTextElement.style.display != "none"){
      webcastBegin();
    }
  }
}

webcastWait();
setInterval(isRunning, 5000);
