# jrjr.pl — home relay

Mały klient, który ma chodzić na Twoim komputerze domowym przez czas
streamu. Co 5 minut otwiera headless Chromium na YouTube, robi
screenshot widgetu i wysyła PNG na VPS — tam jest OCR i aktualizacja
licznika.

**Po co to istnieje:** VPS-y (OVH, Hetzner, wszyscy) mają IP flagowane
przez Google — YouTube odmawia serwowania playera. Twój komputer
domowy ma zwykły, konsumencki IP, który nie ma tego problemu. Zero
proxy, zero kosztów.

## Wymagania

- Dowolny komputer na Windows / macOS / Linux, który ma internet i
  może chodzić przez 9 dni streamu.
- Node.js 20+ (<https://nodejs.org> → pobierz LTS).
- ~500 MB miejsca na dysku (Chromium via Playwright waży ~250 MB + wheel
  Playwrighta).
- ~10 MB internetu na godzinę (1 screenshot / 5 min × 12 = 72 MB/day).

## Pierwsza instalacja — Windows

1. **Zainstaluj Node.js** z <https://nodejs.org>. Wybierz LTS. Po
   instalacji zrestartuj PC (żeby `node` był widoczny wszędzie w PATH).
2. Pobierz / skopiuj ten folder `home-relay/` na swój komputer.
   Możesz go mieć np. w `C:\jrjr-relay\`.
3. Otwórz **PowerShell** w tym folderze (Shift+prawy klik na pustym
   miejscu → „Otwórz w terminalu" / „Open PowerShell here").
4. Zainstaluj zależności:
   ```powershell
   npm install
   npm run install-browsers
   ```
   Pierwsze `install-browsers` ściąga Chromium (~250 MB, 1–2 min).
5. Skopiuj plik konfiguracji:
   ```powershell
   copy .env.example .env
   notepad .env
   ```
6. W Notatniku uzupełnij **dwa pola**:
   - `VPS_URL` — pełny URL Twojego VPS-a, np. `http://51.75.65.32:8010`
     (albo `https://jrjr.pl` po wdrożeniu certbota).
   - `SESSION_SECRET` — musi być **dokładnie taki sam** jak na VPS w
     `/var/www/jrjr/.env`. Skopiuj 1:1. Bez tego VPS nie przyjmie
     uploadów (odpowie 401).

   Resztę zostaw bez zmian. Zapisz (Ctrl+S), zamknij.

## Pierwsza instalacja — macOS / Linux

Identycznie, tylko zamiast PowerShella terminal, zamiast `copy` — `cp`.

```bash
cd ~/jrjr-relay
npm install
npm run install-browsers
cp .env.example .env
nano .env    # uzupełnij VPS_URL i SESSION_SECRET
```

## Uruchamianie

**Windows:**

Podwójny klik na `start.cmd`. Otworzy się okienko konsoli i co 5 minut
wypisze linię typu:

```
[relay] 2026-04-23T15:05:10.123Z  grab=5421ms upload=310ms  sum=6098600.29 PLN
[relay]   region 1 (tipply): 247454
[relay]   region 2 (siepomaga): 5851146.29
```

Jak chcesz zamknąć — Ctrl+C albo X okna. Nie zatrzymuje streamu, tylko
licznik przestaje się aktualizować (pokaże ostatnią znaną kwotę).

**macOS / Linux:**

```bash
cd ~/jrjr-relay
npm start
```

## Autostart z Windowsem (zalecane na czas streamu)

Żebyś nie musiał uruchamiać ręcznie po każdym włączeniu komputera:

1. Naciśnij `Win + R`, wpisz `shell:startup`, Enter.
2. Otworzy się folder autostartu.
3. Przeciągnij do niego **skrót** (prawy klik → „Utwórz skrót") do
   `start.cmd`. Skrót, nie sam plik.
4. Po restartu PC relay odpala się samoczynnie.

## Kalibracja

Zanim relay zacznie liczyć, wejdź na stronie VPS-a w
`/admin → Kalibracja OCR`, kliknij „Pobierz świeżą klatkę" (to odpala
również relay-owe klatki, bo VPS zapisuje każdy upload jako
`last-frame.jpg`), narysuj prostokąty nad kwotami na widgecie, zapisz.

Dopóki nie ma żadnego prostokąta, relay uploaduje klatki (możesz je
obejrzeć w kalibratorze), ale OCR nie policzy kwoty. Po pierwszym
prostokącie — wszystko działa.

## Troubleshooting

### „401 Unauthorized" w logach

`SESSION_SECRET` w `.env` relay-a nie zgadza się z tym na VPS-ie. Wklej
od nowa, zwróć uwagę na spacje / newline.

### „Connection refused" / „ETIMEDOUT"

VPS_URL źle wpisany albo VPS wyłączony / nie słucha na porcie 8010.
Sprawdź `curl -I http://51.75.65.32:8010/api/counter` z Twojego
komputera — powinno wrócić 200.

### „playwright: Executable doesn't exist"

Chromium się nie ściągnął. W folderze uruchom:

```
npm run install-browsers
```

### Okienko zamyka się od razu po dwu-kliku na `start.cmd`

Brakuje `.env` albo `node_modules`. Otwórz PowerShell, wejdź w folder,
uruchom tam, zobaczysz prawdziwy komunikat błędu.

### Chcę zmienić interwał

Edytuj `.env` → `INTERVAL_MINUTES`. Restart relay-a (zamknij + uruchom).

## Bezpieczeństwo

- Plik `.env` trzyma `SESSION_SECRET` — nie commituj nigdzie, nie
  wrzucaj na Dysk Google, nie wysyłaj znajomym.
- Relay nie zbiera żadnych Twoich danych. Tylko odpala Chromium,
  screenshotuje YouTube, wysyła obrazek na VPS. Żadnego telemetrycznego
  pingu, żadnego analytics.
