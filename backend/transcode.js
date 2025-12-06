
import { XMLParser } from 'fast-xml-parser';
import { spawn } from "child_process";
import { deepEqual } from 'fast-equals';

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0; // nekontrolovat vydavatele certifikátu

var ffmpeg;
var previousUrls = [];

async function fetchStats() {
    const res = await fetch('https://localhost/stats');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    const text = await res.text();

    const parser = new XMLParser();
    const data = await parser.parse(text);

    return data;
}

function broadcasterRtmpUrls(stats) {
  const streams = stats.rtmp.server.application.find(a => a.name === "broadcasters").live.stream;

  if(streams == undefined){
    return [];
  }

  const streamsArray = Array.isArray(streams) ? streams : [streams];
  let urls = [];

  streamsArray.forEach(stream => {
    urls.push(`rtmp://localhost/broadcasters/${stream.name}`);
  });

  return urls;
}

export function transcode() {
    fetchStats().then(stats =>
        transcodeBroadcasts(stats)
    );
}

function transcodeBroadcasts(stats){
    const urls = broadcasterRtmpUrls(stats);

    //check if different
    if(deepEqual(previousUrls, urls)) return;
    previousUrls = urls;

    if(deepEqual(urls, [])) return;
    
    console.log(urls);

    const streamsInGrid = 6;

    // stop FFmpeg if running already
    if(ffmpeg != undefined){
      ffmpeg.stdin.end();
    }

    //dynamically add inputs
    var ffmpegArgs = [];
    urls.forEach(url => {
        ffmpegArgs.push("-f", "flv", "-i", url);
    });

    for(var i = streamsInGrid; i > urls.length; i--){
        ffmpegArgs.push("-f", "lavfi", "-i", "nullsrc=size=640x480", "-f", "lavfi", "-i", "anullsrc");
    }

    ffmpegArgs.push(
      // make a grid 3x2 - source: https://www.phpied.com/video-grids-with-ffmpeg/
      "-filter_complex",
      "xstack=inputs=6:layout=0_0|0_h0|w0_0|w0_h0|w0+w3_0|w0+w3_h0:fill=black:shortest=1[v];[v]scale=640:360[360p];[v]scale=854:480[480p];[v]scale=1280:720[720p]",
      //"-map", "[out]",

      // send 360p, 480p, 720p and source quality to nginx hls (using RTMP)
      "-c:v","libx264", "-c:a","aac", "-b:v", "256k", "-b:a", "32k", "-map", "[360p]", //"-vf", "scale='640:360'",
      "-preset", "veryfast", "-f", "flv", "rtmp://localhost:1935/hls/stream_360",
      "-c:v","libx264", "-c:a","aac", "-b:v", "384k", "-b:a", "64k", "-map", "[480p]", //"-vf", "scale='854:480'",
      "-preset", "veryfast", "-f", "flv", "rtmp://localhost:1935/hls/stream_480",
      "-c:v","libx264", "-c:a","aac", "-b:v", "1920k", "-b:a", "128k", "-map", "[720p]", //"-vf", "scale='1280:720'",
      "-preset", "veryfast", "-f", "flv", "rtmp://localhost:1935/hls/stream_720"/*,
      "-c:v","libx264", "-c:a","aac", "-b:v", "1920k", "-b:a", "128k", "-map", "[src]",
      "-preset", "veryfast", "-f", "flv", "rtmp://localhost:1935/hls/stream_src"*/
    );

    ffmpeg = spawn("ffmpeg", ffmpegArgs, {stdio: ["pipe", "pipe", "pipe", "pipe", "pipe", "pipe", "pipe", "pipe", "pipe"]});

    ffmpeg.stderr.on("data", d => console.log("Transkódovací FFmpeg:", d.toString()));
    ffmpeg.on("close", () => console.log("Transkódování ukončeno"));
}
