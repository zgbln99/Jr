# Deploy na Mikrus VPS (port 8010)

Ten plik prowadzi krok po kroku przez wrzucenie jrjr.pl na VPS-a z
Mikrusa. Założenie: Next.js słucha na `127.0.0.1:8010`, a publicznie
stronę wystawiamy przez wbudowane proxy Mikrusa (panel `mikr.us`) albo
przez mapowanie portu w zakładce „Porty".

## 1. Zaloguj się na VPS

Dane z maila powitalnego (`amici`, port SSH, hasło root):

```bash
ssh root@srvXX.mikr.us -p <PORT_SSH>
```

Od razu zmień hasło (`passwd`) i zaktualizuj pakiety:

```bash
apt update && apt -y upgrade
```

## 2. Zainstaluj Node.js 20 + narzędzia

Mikrus ma zwykle stary Node w repo. Bierzemy świeży z NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs build-essential python3 ffmpeg tesseract-ocr tesseract-ocr-pol git
```

yt-dlp najlepiej wziąć prosto z releasu (wersja w apt często jest
przestarzała i YouTube ją blokuje):

```bash
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod +x /usr/local/bin/yt-dlp
yt-dlp --version
```

**Dlaczego Tesseract, a nie PaddleOCR?** PaddleOCR + paddlepaddle to
~1 GB na dysku i 400–600 MB RAM-u w runtime. Mikrus (mały plan) ma zwykle
512 MB – 2 GB RAM. Tesseract z `pol+eng` świetnie czyta proste,
kontrastowe cyfry z widżetu zrzutki i zajmuje ~100 MB. Jeśli masz
większego Mikrusa (premium) i wolisz Paddle, ustaw `OCR_ENGINE=paddle`
w `.env` i doinstaluj: `apt install python3-pip && pip install
--break-system-packages paddlepaddle paddleocr`.

## 3. Sklonuj projekt

Mikrus zwykle jest ciasny z miejscem, więc clone bez historii:

```bash
useradd -r -m -d /var/www/jrjr jrjr
su - jrjr -s /bin/bash
git clone --depth 1 -b claude/charity-stream-website-kfWL5 \
  https://github.com/zgbln99/Jr.git /var/www/jrjr
exit
chown -R jrjr:jrjr /var/www/jrjr
```

## 4. Skonfiguruj `.env`

```bash
cd /var/www/jrjr
sudo -u jrjr cp .env.example .env
```

Edytuj:

```bash
sudo -u jrjr nano .env
```

Minimum, co musisz ustawić:

| zmienna | wartość |
| --- | --- |
| `ADMIN_USERNAME` | Twój login do `/admin` |
| `ADMIN_PASSWORD` | długie, losowe hasło |
| `SESSION_SECRET` | `openssl rand -hex 32` — wklej wynik |
| `PORT` | `8010` |
| `HOSTNAME` | `127.0.0.1` (stoimy za proxy Mikrusa) |
| `OCR_ENGINE` | `tesseract` |
| `NEXT_PUBLIC_SITE_URL` | `https://jrjr.pl` |

## 5. Zbuduj

```bash
sudo -u jrjr npm ci
sudo -u jrjr npm run build
sudo -u jrjr npm run db:init
```

`better-sqlite3` kompiluje się natywnie pod Twoje glibc — stąd
`build-essential` + `python3` w kroku 2. Kompilacja trwa ~1–2 min na
Mikrusie, potem nie wraca.

## 6. Uruchom jako usługi systemd

Skopiuj gotowe unity:

```bash
cp /var/www/jrjr/deploy/jrjr-web.service /etc/systemd/system/
cp /var/www/jrjr/deploy/jrjr-ocr.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now jrjr-web jrjr-ocr
```

Sprawdź:

```bash
systemctl status jrjr-web --no-pager
systemctl status jrjr-ocr --no-pager
curl -sS http://127.0.0.1:8010/api/counter
```

Powinieneś zobaczyć `{"amount":0,...}` — licznik jeszcze pusty, worker
zaraz wypełni.

Logi:

```bash
journalctl -u jrjr-web -f        # serwer
journalctl -u jrjr-ocr -f        # OCR
```

## 7. Wystaw stronę na świat

Masz **dwie drogi**, wybierz jedną.

### Opcja A (zalecana) — proxy WWW Mikrusa z HTTPS na jrjr.pl

Mikrus ma gotowy reverse-proxy, który kończy TLS i przekierowuje ruch
HTTPS na Twój wewnętrzny port.

1. W [panelu mikr.us](https://mikr.us/panel/) → `WWW` → `Dodaj domenę`:
   - domena: `jrjr.pl`
   - port wewnętrzny: `8010`
   - zaznacz `Let's Encrypt` (bezpłatny cert)
2. W DNS swojego rejestratora ustaw rekord A z `jrjr.pl` i `www.jrjr.pl`
   na adres IP, który pokazuje panel Mikrusa w sekcji `INFO`.
3. Odczekaj 5–60 min na propagację DNS + pierwsze wystawienie certu.

Potem `https://jrjr.pl` trafia do Twojego `127.0.0.1:8010`. Niczego
więcej nie robisz.

### Opcja B — własny port publiczny (bez HTTPS na domenie)

Jeśli chcesz sprawdzić tylko na szybko, bez domeny:

1. Panel Mikrusa → `Porty` → `Dodaj port` → przypisz publiczny port
   (np. `10810`) do wewnętrznego `8010`.
2. W `.env` zmień `HOSTNAME=0.0.0.0`, zrestartuj: `systemctl restart
   jrjr-web`.
3. Wchodzisz na `http://srvXX.mikr.us:10810`.

Ta opcja nie daje HTTPS-a i nie obsługuje `jrjr.pl` — jest tylko do
szybkiego podglądu.

## 8. Weryfikacja OCR

Worker odpala się co 5 min. Po ~6 min sprawdź:

```bash
journalctl -u jrjr-ocr --since '10 min ago'
```

Linia `[ocr] amounts=X + Y = Z.ZZ PLN` = wszystko działa.

Jeśli widzisz `no amounts parsed`, spróbuj:
- upewnić się, że stream na YouTube faktycznie leci na żywo (`yt-dlp -g
  "$STREAM_URL"` powinno zwrócić URL HLS),
- podkręcić crop w `.env` (`CROP_X`, `CROP_Y`, `CROP_W`, `CROP_H`),
- zerknąć w wyrywkową klatkę:

  ```bash
  cd /var/www/jrjr
  yt-dlp -q -o - -f 'best[height<=720]/best' "$(grep ^STREAM_URL .env | cut -d= -f2-)" \
    | ffmpeg -i pipe:0 -frames:v 1 -y /tmp/frame.jpg
  ffmpeg -i /tmp/frame.jpg -vf "crop=iw*0.55:ih*0.6:0:ih*0.4" -y /tmp/crop.jpg
  ```
  Potem `scp` tego `/tmp/crop.jpg` do siebie i obejrzyj, czy widżet
  jest w kadrze. Jeśli nie, dostrój procentów.

## 9. Aktualizacje

Po `git pull` nowych zmian:

```bash
sudo -u jrjr /var/www/jrjr/deploy/deploy.sh
```

Skrypt robi: `git pull` → `npm ci` → `npm run build` → `systemctl
restart jrjr-web jrjr-ocr`.

## 10. Jak zwolnić pamięć, jeśli Mikrus się dusi

- `OCR_INTERVAL_MINUTES=10` — mniej cykli OCR-u.
- `OCR_ENGINE=tesseract` — jeśli jeszcze nie używasz.
- `systemctl stop jrjr-ocr` — gdy podziwiasz licznik ręcznie.
- `next start` trzyma `.next/cache` — można skasować po buildzie:
  `rm -rf .next/cache` (odbuduje się przy następnym `next build`).

## 11. Backup bazy

Plik `./data/jrjr.db` (SQLite) to cała Twoja baza: licznik, ustawienia,
goście, media. Prosty codzienny backup cronem:

```bash
crontab -u jrjr -e
# dodaj:
0 3 * * * cd /var/www/jrjr && cp data/jrjr.db data/jrjr-$(date +\%F).db && find data/ -name 'jrjr-*.db' -mtime +7 -delete
```
