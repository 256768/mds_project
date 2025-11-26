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

1. Install required packages
    ```bash
    sudo apt install nginx libnginx-mod-rtmp openssl nodejs npm
    ```
2. Free up port 80 by stopping and disabling nginx service
    ```bash
    sudo systemctl stop nginx
    sudo systemctl disable nginx
    ```
3. Generate server certificate and key (working directory is base of the repository)
    ```bash
    openssl req -x509 -newkey rsa:4096 -keyout conf/ssl/key.pem -out conf/ssl/cert.pem -sha256 -days 365 -nodes -subj "/C=CZ/ST=CZ/L=Brno/O=VUTFEKT/OU=BPCMDS/CN=webcast.example.com"
    ```
4. Run project in nginx (working directory is base of the repository)
    ```bash
    sudo nginx -p . -c conf/nginx.conf -g "load_module '/usr/lib/nginx/modules/ngx_rtmp_module.so';"
    ```
5. Install node packages (working directory is backend)
    ```bash
    npm install .
    ```
6. Run backend (working directory is backend)
    ```bash
    node .
    ```
