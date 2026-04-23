# jrjr.pl — home relay

Mały klient, który chodzi na Twoim komputerze domowym. Co X minut pobiera
klatkę ze streamu YouTube przez `yt-dlp + ffmpeg` i wysyła ją na VPS,
gdzie jest OCR licznika. Twój PC ma zwykłe domowe IP, więc YouTube
serwuje stream bez problemów — żadnego proxy, żadnych cookies
z loginem.

## Wymagania

- Dowolny komputer na Windows / macOS / Linux, który ma internet.
- Node.js 20+ (<https://nodejs.org>, LTS).
- ~60 MB miejsca na dysku (ffmpeg-static + yt-dlp).
- ~5 MB internetu / tick (tick co 5 min → ~1.5 GB / 9 dni).

## Instalacja (Windows)

1. Zainstaluj Node.js LTS ze strony <https://nodejs.org>, potem
   zrestartuj PC żeby `node` trafił do PATH.
2. Skopiuj folder `home-relay/` na swój PC (np. `C:\jrjr-relay\`).
3. PowerShell → Shift+prawy klik na folderze → „Otwórz PowerShell tutaj":
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   npm install
   copy .env.example .env
   notepad .env
   ```
4. W Notatniku uzupełnij:
   - `VPS_URL=http://51.75.65.32:8010` (lub `https://jrjr.pl` po certbocie)
   - `SESSION_SECRET=` wklej 1:1 to co masz w `/var/www/jrjr/.env` na VPS
   - Resztę zostaw

   Zapisz (Ctrl+S), zamknij.

## Uruchamianie

Podwójny klik na `start.cmd`, albo w PowerShellu:

```powershell
node relay.mjs
```

Przy pierwszym uruchomieniu relay pobiera `yt-dlp.exe` z GitHuba
(~10 MB, jedyny raz) i zapisuje obok `relay.mjs`. Windows Defender
może wyświetlić ostrzeżenie — „Uruchom mimo to", bo to zaufany binarka
z oficjalnego releasu yt-dlp.

Po zainicjowaniu:

```
[relay] starting · VPS=http://... · stream=... · interval=300s
[relay] resolving stream URL via yt-dlp ...
[relay] got URL in 2140ms, valid for ~118 min
[relay] 16:10:03  ff=1820ms up=320ms  6139722.46 PLN
[relay]   region 1 (tipply): 947253
[relay]   region 2 (siepomaga): 6139722.46
```

Każdy kolejny tick to tylko `ffmpeg → upload`, ~2 sekundy. Co ~30 min
(lub gdy URL wygaśnie wcześniej) relay pyta yt-dlp o świeży URL.

## Autostart z Windows

1. `Win + R` → `shell:startup` → Enter
2. Otworzy się folder autostartu
3. Przeciągnij do niego **skrót** (prawy klik → „Utwórz skrót") na `start.cmd`

Od teraz relay startuje automatycznie po włączeniu PC-ta.

## macOS / Linux

Analogicznie, tylko zamiast `copy` → `cp`, zamiast `notepad` → `nano`:

```bash
cd ~/jrjr-relay
npm install
cp .env.example .env
nano .env
node relay.mjs
```

Relay ściąga `yt-dlp` (Linux) albo `yt-dlp_macos` (macOS) automatycznie.

## Troubleshooting

- **`401 Unauthorized`** — `SESSION_SECRET` w `.env` nie zgadza się z
  VPS-em. Skopiuj dokładnie, łącznie z tym co po `=`.
- **`yt-dlp timeout` / `No video formats`** — yt-dlp czasem wymaga
  aktualizacji pod YouTube'owe zmiany. Usuń `yt-dlp.exe` z folderu,
  uruchom `node relay.mjs` — ściągnie najnowszą wersję.
- **`ECONNREFUSED` / `ETIMEDOUT`** — VPS wyłączony albo `VPS_URL` źle.
  Test z PC: `curl -I http://51.75.65.32:8010/api/counter` → 200.
- **Chcę dłuższe/krótsze odstępy** — `INTERVAL_MINUTES=5` (domyślnie) w
  `.env`, albo `INTERVAL_SECONDS=10` dla sub-minutowego cadence.

## Bezpieczeństwo

- `.env` trzyma `SESSION_SECRET` — nie commituj nigdzie, nie wrzucaj
  na Dysk Google, nie wysyłaj znajomym.
- Relay nie zbiera żadnych Twoich danych. Tylko `yt-dlp` pyta YouTube
  o URL, `ffmpeg` pobiera klatkę, fetch wysyła JPEG na Twój VPS.
- `yt-dlp.exe` jest pobierany z oficjalnego releasu <https://github.com/yt-dlp/yt-dlp/releases/latest>.
