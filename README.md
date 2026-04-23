# jrjr.pl

Nieoficjalna strona akcji charytatywnej **Łatwogang × Bedoes × Cancer Fighters** — dziewięciodniowej transmisji, podczas której na streamie leci jeden utwór (Maja × Bedoes), a widzowie wpłacają na Fundację Cancer Fighters.

Strona pokazuje:

- licznik wpłat czytany OCR-em z live-streamu co 5 minut (dwa liczniki w lewym dolnym rogu kadru sumowane do jednego),
- informacje o akcji, inicjatorach, fundacji,
- listę gości, którzy już byli i tych zapowiedzianych,
- embed live-streamu,
- linki do zrzutek (obie bez prowizji).

Pod spodem prosty panel admina, w którym właściciel edytuje wszystko, co może się zmienić: linki do zrzutek, datę końca streamu, treść sekcji, listę gości i ręczny override licznika (jeśli OCR się rypnie).

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** z design-tokenami z `DESIGN-stripe.md`
- **better-sqlite3** (SQLite plik w `./data/jrjr.db`)
- **iron-session** do sesji admina
- **OCR worker**: `yt-dlp` → `ffmpeg` → PaddleOCR (z fallbackiem do Tesseract)

## Struktura

```
app/
  page.tsx              strona główna
  admin/                panel (login + dashboard)
  api/
    counter/            publiczny GET — aktualny stan licznika
    admin/              CRUD dla panelu (chronione sesją)
    internal/ocr/       wejście dla workera OCR (chronione SESSION_SECRET)
components/             sekcje: Hero, Counter, Guests, ...
lib/
  db.ts                 schema + helpery SQLite
  auth.ts               iron-session + stałoczasowe porównanie haseł
scripts/
  ocr-worker.mjs        worker czytający klatkę ze streamu
  db-init.mjs           one-shot inicjalizacja bazy
deploy/                 przykładowe unity systemd + snippet nginx
```

## Uruchomienie lokalne

```bash
cp .env.example .env
# Wygeneruj SESSION_SECRET:
openssl rand -hex 32
# Wklej do .env jako SESSION_SECRET. Ustaw ADMIN_USERNAME i ADMIN_PASSWORD.

npm install
npm run db:init     # tworzy data/jrjr.db (również zrobi się auto na starcie serwera)
npm run dev         # http://localhost:3000
```

Panel admina: `http://localhost:3000/admin/login`.

OCR worker (osobny proces):

```bash
npm run ocr
```

Worker wymaga `yt-dlp`, `ffmpeg` i albo `paddleocr` (zalecane), albo `tesseract-ocr`.

## Deployment na VPS (Ubuntu/Debian)

1. **Instalacja zależności systemowych**:

   ```bash
   sudo apt update
   sudo apt install -y nodejs npm ffmpeg yt-dlp tesseract-ocr tesseract-ocr-pol python3-pip
   pip install --break-system-packages paddlepaddle paddleocr
   ```

2. **Kod**:

   ```bash
   sudo useradd -r -m -d /var/www/jrjr jrjr
   sudo -u jrjr git clone https://github.com/<twoj-org>/jr.git /var/www/jrjr
   cd /var/www/jrjr
   sudo -u jrjr cp .env.example .env
   sudo -u jrjr nano .env   # uzupełnij ADMIN_* i SESSION_SECRET
   sudo -u jrjr npm ci
   sudo -u jrjr npm run build
   sudo -u jrjr npm run db:init
   ```

3. **systemd**:

   ```bash
   sudo cp deploy/jrjr-web.service /etc/systemd/system/
   sudo cp deploy/jrjr-ocr.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now jrjr-web jrjr-ocr
   sudo journalctl -u jrjr-web -f    # podgląd logów
   sudo journalctl -u jrjr-ocr -f
   ```

4. **nginx + HTTPS**:

   ```bash
   sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/jrjr.pl
   sudo ln -s /etc/nginx/sites-available/jrjr.pl /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d jrjr.pl -d www.jrjr.pl
   ```

   `deploy/nginx.conf.example` domyślnie blokuje `/api/internal/*` z publicznego ruchu — worker i tak chodzi przez `127.0.0.1`.

## Kalibracja OCR

Dwa liczniki są w lewym dolnym rogu kadru. Domyślny crop (ustawiony w `scripts/ocr-worker.mjs` jako `CROP_X / CROP_Y / CROP_W / CROP_H` w `.env`) wycina:

- startuje na 0% szerokości, 60% wysokości,
- bierze 45% szerokości, 40% wysokości.

Jeśli OCR łapie nie to co trzeba:

```bash
# Zrzuć jedną klatkę lokalnie i obejrzyj crop:
STREAM_URL=https://... node scripts/ocr-worker.mjs &
# lub w .env wyreguluj procenty — 0 to górny-lewy, 1 to prawy-dolny.
```

Jeśli w streamie zmienia się układ (np. overlay przesuwa się), zmień crop i zrestartuj worker — nic nie trzeba rekompilować.

## Override ręczny

Wchodzisz w `/admin → Licznik → Override ręczny`, wpisujesz kwotę, zapisujesz. Wartość pojawia się na stronie natychmiast i nadpisuje ostatni odczyt OCR do momentu, aż worker zrobi nowy (co 5 min). Jeśli chcesz "zamrozić" kwotę, zatrzymaj workera:

```bash
sudo systemctl stop jrjr-ocr
```

## Nieoficjalność

Strona jest fanowska. W stopce jest jawne disclaimer. Żadne logo Łatwogang, Bedoes ani Fundacji nie jest hostowane w repo — wszystko co jest właścicielami znaków słownych/graficznych, admin linkuje dopiero po uzyskaniu zgody.
