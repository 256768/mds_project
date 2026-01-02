# MDS project
This repository is intended for the final project for the BPC-MDS course at BUT FEEC. It contains all the relevant code, documentation and resources.

## Authors
- 256768
- 247190
- 240218

## Project schema
![Project schema](schema.svg)

# Dokumentace k týmovému projektu MDS 2025

Tento projekt implementuje multimediální službu pro prezentaci živého obrazu z webových kamer, automatické skládání obrazu do mřížky (grid) a následnou distribuci pomocí protokolu HLS (HTTP Live Streaming).

## Pokyny pro publikující (Vysílání)
Publikování probíhá prostřednictvím webového rozhraní, které komunikuje se serverem přes WebSocket.

## Jak spustit

### Windows

To be added soon.

### Ubuntu

1. Nainstalujte potřebné balíčky
    ```bash
    sudo apt install nginx libnginx-mod-rtmp openssl nodejs npm
    ```
2. Uvolněte port 80 - je nutné zastavit a deaktivovat systémovou službu Nginx, aby nekolidovala s naší konfigurací.
    ```bash
    sudo systemctl stop nginx
    sudo systemctl disable nginx
    ```
3. Vygenerujte serverový certifikát a klíč (Příkaz spouštějte v kořenovém adresáři repozitáře)
    ```bash
    openssl req -x509 -newkey rsa:4096 -keyout conf/ssl/key.pem -out conf/ssl/cert.pem -sha256 -days 365 -nodes -subj "/C=CZ/ST=CZ/L=Brno/O=VUTFEKT/OU=BPCMDS/CN=webcast.example.com"
    ```
4. Spusťte projekt v nginx (Příkaz spouštějte v kořenovém adresáři repozitáře)
    ```bash
    sudo nginx -p . -c conf/nginx.conf -g "load_module '/usr/lib/nginx/modules/ngx_rtmp_module.so';"
    ```
5. Nainstalujte node balíčky (Příkaz spouštějte ve složce backend)
    ```bash
    npm install .
    ```
6. Spusťte backend (Příkaz spouštějte ve složce backend)
     ```bash
    node .
    ```

### Přihlášení

Pro zahájení vysílání je nutná autentizace.
- Výchozí heslo: vysilam123
- Autentizační endpoint: POST /api/auth/login
- V sekci Nastavení vysílání lze posléze nastavit jméno vysílajícího, ztlumit mikrofon, spustit či zastavit vysílání a také se odhlásit.

### Průběh vysílání
Po úspěšném přihlášení a získání tokenu se prohlížeč připojí k WebSocketu (ws://localhost/broadcast). Video data jsou streamována na server, kde jsou zpracována FFmpegem a přeposlána do lokálního RTMP (rtmp://localhost:1935/broadcasters/name).

### Zobrazení v mřížce
Server automaticky detekuje aktivní streamy. Pokud vysílá více uživatelů (max 6), server (skript transcode.js) automaticky vytvoří kompozitní obraz (mřížku) a začne generovat adaptivní HLS stream (rozlišení 360p, 480p, 720p).

## Pokyny pro sledující
Diváci mohou sledovat výsledný stream na adrese: https://localhost/ (při lokálním testování)

### Funkce přehrávače
Přehrávač automaticky načítá HLS playlist z adresy /hls. Dostupné jsou statistiky streamu na adrese /stats (refresh každé 3 sekundy).










