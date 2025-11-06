# MDS project
This repository is intended for the final project for the BPC-MDS course at BUT FEEC. It contains all the relevant code, documentation and resources.

## Authors
- 256768
- 247190
- 240218

## Project schema
![Project schema](schema.svg)

## How to start

### Windows

To be added soon.

### Ubuntu

1. Download nginx and RTMP plugin
    ```bash
    sudo apt install nginx libnginx-mod-rtmp
    ```
2. Free up port 80 by stopping and disabling nginx service
    ```bash
    sudo systemctl stop nginx
    sudo systemctl disable nginx
    ```
3. Run project in nginx (working directory is base of the repository)
    ```bash
    sudo nginx -p . -c conf/nginx.conf -g "load_module '/usr/lib/nginx/modules/ngx_rtmp_module.so';"
    ```
