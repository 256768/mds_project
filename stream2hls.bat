REM Script for Windows because exec refuses to work
ffmpeg -y -i rtmp://localhost/broadcast/stream -map 0:v -map 0:a ^
              -c:v libx264 -c:a aac -b:v 256k -b:a 32k -vf scale='640:360' -preset veryfast -f flv rtmp://localhost/hls/stream_360 ^
              -c:v libx264 -c:a aac -b:v 384k -b:a 64k -vf scale='854:480' -preset veryfast -f flv rtmp://localhost/hls/stream_480 ^
              -c:v libx264 -c:a aac -b:v 1920k -b:a 128k -vf scale='1280:720' -preset veryfast -f flv rtmp://localhost/hls/stream_720 ^
			  -c copy -f flv rtmp://localhost/hls/stream_src
