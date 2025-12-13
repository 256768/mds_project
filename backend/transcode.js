
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
    //not working
    if(stream.active != undefined){
      urls.push(`rtmp://localhost/broadcasters/${stream.name}`);
    }
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

    // stop FFmpeg if running already
    if(ffmpeg != undefined){
      ffmpeg.stdin.end();
    }

    //dynamically add inputs
    var inputCounter = 0;
    var ffmpegArgs = [
      //analyze inputs and find video streams
      "-probesize", "10M", "-analyzeduration", "20M"
    ];
    urls.forEach(url => {
        ffmpegArgs.push("-c:v", "h264", "-c:a", "aac", "-f", "flv", "-i", url);
        inputCounter++;
    });

    //set layout
    var layout = "";
    switch(inputCounter){
      case 2:
        //2x1
        layout = "0_0|w0_0";
        break;
      case 3:
        //2+1 - not tested
        layout = "0_0|0_h0|w0_0";
        break;
      case 4:
        //2x2 - not tested
        layout = "0_0|w0_0|0_h0|w0_h0";
        break;
      case 5:
        //3x2 one empty slot - not tested
        layout = "0_0|w0_0|2*w0_0|0_h0|w0_h0";
        break;
      case 6:
        //3x2 - not tested
        layout = "0_0|w0_0|2*w0_0|0_h0|w0_h0|2*w0_h0"; //0_0|0_h0|w0_0|w0_h0|w0+w3_0|w0+w3_h0
        break;
    }

    //filters differ if only one input
    var complexFilter;
    if(inputCounter == 1){
      complexFilter = "split=3[v1][v2][v3];[v1]scale=640:360[360p];[v2]scale=854:480[480p];[v3]scale=1280:720[720p];asplit=3[a360p][a480p][a720p]";
    }else{
      complexFilter = "xstack=inputs="+inputCounter+":layout="+layout
          +":fill=black:shortest=1[vgrid];[vgrid]split=3[v1][v2][v3];[v1]scale=640:360[360p];[v2]scale=854:480[480p];[v3]scale=1280:720[720p];amix=inputs="
          +inputCounter+"[a];[a]asplit=3[a360p][a480p][a720p]";
    }

    ffmpegArgs.push(
      // make a grid 
      "-filter_complex", complexFilter,

      // send 360p, 480p, 720p and source quality to nginx hls (using RTMP)
      "-c:v","libx264", "-c:a","aac", "-b:v", "256k", "-b:a", "32k", "-r", "30", "-map", "[360p]", "-map", "[a360p]",
      "-preset", "veryfast", "-f", "flv", "rtmp://localhost:1935/hls/stream_360",
      "-c:v","libx264", "-c:a","aac", "-b:v", "384k", "-b:a", "64k", "-r", "30", "-map", "[480p]", "-map", "[a480p]",
      "-preset", "veryfast", "-f", "flv", "rtmp://localhost:1935/hls/stream_480",
      "-c:v","libx264", "-c:a","aac", "-b:v", "1920k", "-b:a", "128k", "-r", "30", "-map", "[720p]", "-map", "[a720p]",
      "-preset", "veryfast", "-f", "flv", "rtmp://localhost:1935/hls/stream_720"
    );

    ffmpeg = spawn("ffmpeg", ffmpegArgs);

    ffmpeg.stderr.on("data", d => console.log("Transkódovací FFmpeg:", d.toString()));
    ffmpeg.on("close", () => console.log("Transkódování ukončeno"));
}
