export const ffmpegArgs = [
    "-i", "pipe:0",

    "-filter_complex",
    "[0:v]split=3[v1080][v720][v480];" +
    "[v1080]scale=-2:1080:flags=lanczos[v1080out];" +
    "[v720]scale=-2:720:flags=lanczos[v720out];" +
    "[v480]scale=-2:480:flags=lanczos[v480out]",

    // mapovani videa a audia (ruzne kvality videa maji STEJNE audio)
    "-map", "[v1080out]", "-map", "0:a",
    "-map", "[v720out]", "-map", "0:a",
    "-map", "[v480out]", "-map", "0:a",

    // video encode pro jednotlive varianty
    "-c:v:0", "libx264", "-b:v:0", "8000k", "-preset", "veryfast", "-tune", "zerolatency",
    "-c:v:1", "libx264", "-b:v:1", "4000k", "-preset", "veryfast", "-tune", "zerolatency",
    "-c:v:2", "libx264", "-b:v:2", "1500k", "-preset", "veryfast", "-tune", "zerolatency",

    // audio
    "-c:a", "aac", "-b:a", "128k",

    // HLS nastaveni
    "-f", "hls",
    "-hls_time", "4",
    "-hls_playlist_type", "event",
    "-hls_segment_filename", "/home/petr/Dokumenty/5. semestr/mds/mds_project/backend/hls/output/seg_%v_%03d.ts",
    "-master_pl_name", "master.m3u8",
    "-var_stream_map", "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p",

    "/hls/output/stream_%v.m3u8"
];
