const playerElement = document.getElementById('hlsPlayer');
const playerContainerElement = document.getElementById('playerContainer');
const stoppedTextElement = document.getElementById('broadcastStoppedText');
const playerCardElement = document.getElementById('playerCard');
const infoCardElement = document.getElementById('infoCard');

// do elementu playerElement prida funkcionalitu knihovny Video.js
var options = {
    fluid: true //meni se velikost dle okna
};
var player = videojs(playerElement, options);

function webcastBegin(){
  playerContainerElement.style.display = 'block';
  stoppedTextElement.style.display = 'none';
  playerCardElement.classList.remove("flex-fill");
  playerCardElement.classList.add("col-8");
  infoCard.style.display = 'block';
}

function webcastWait(){

    player.src({
      type: "video/mp4",
      src: "https://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4"
    });
    player.play();

  playerContainerElement.style.display = 'none';
  stoppedTextElement.style.display = 'block';
  playerCardElement.classList.remove("col-8");
  playerCardElement.classList.add("flex-fill");
  infoCard.style.display = 'none';

}

webcastWait();
