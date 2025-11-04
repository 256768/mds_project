var playerElement = document.getElementById('hlsPlayer');
// do elementu playerElement prida funkcionalitu knihovny Video.js
var options = {
    fluid: true //meni se velikost dle okna
};
var player = videojs(playerElement, options);
