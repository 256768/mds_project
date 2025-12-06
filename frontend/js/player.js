const playerElement = document.getElementById('hlsPlayer');
const playerContainerElement = document.getElementById('playerContainer');
const stoppedTextElement = document.getElementById('broadcastStoppedText');
const infoElement = document.getElementById('broadcastInfo');
const playerCardElement = document.getElementById('playerCard');
const infoCardElement = document.getElementById('infoCard');

// do elementu playerElement prida funkcionalitu knihovny Video.js
var options = {
    fluid: true, //meni se velikost dle okna
    loop: true,
    muted: true,
    autoplay: true
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

webcastWait();
