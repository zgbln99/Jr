# Residential proxy dla OCR z YouTube

Google / YouTube ma **cały zakres IP OVH-a (i innych providerów VPS) na
czarnej liście** jeśli chodzi o serwowanie live-streamu. Z tego samego
powodu YouTube pokaże widok-zalogowania nawet gdy mamy ważne cookies:
zestaw „cookies sesji + datacenter IP" to dla nich wzorzec bota.

Obejściem jest **residential proxy** — pośrednik, który ma adres IP w
polskiej (albo dowolnej) sieci domowej. YouTube widzi „normalnego
widza", puszcza player, my robimy screenshot.

Potrzebujemy tego tylko dla workera OCR (jeden request co 5 minut),
więc zużywamy minimum bandwidthu (kilka MB na tick).

## Rekomendowani dostawcy

| dostawca | plan | cena | uwagi |
| --- | --- | --- | --- |
| **IPRoyal Royal Residential** | pay-as-you-go | $1.80 / GB | Bez subskrypcji, płacisz za zużycie. Przy 5 MB × 288 ticków/dzień × 9 dni = **~13 GB = $24** za cały 9-dniowy stream. |
| **Webshare Residential** | Basic 100 MB | $3 / mc | 100 MB / mc limitu, przy naszym zużyciu starczy na <1 dzień. Dla całego streamu trzeba plan wyżej ($9 / 2 GB). |
| **Smartproxy Residential** | Pay-as-you-go | $8.50 / GB | Droższe, ale bardzo stabilne. |

Najlepszy wybór dla tego projektu (9 dni streamu): **IPRoyal
pay-as-you-go**, jednorazowo $25–30 na cały event, po akcji nic nie
dopłacamy.

## Konfiguracja — IPRoyal

1. Załóż konto na <https://iproyal.com/> (mail + hasło, bez karty na start)
2. Panel → **Residential** → **Royal Residential** → **Buy traffic**
   → kup pakiet np. $7 (4 GB) żeby wystartować (zawsze można dokupić)
3. Po płatności: panel → **Residential** → **Endpoint generator**
   - Country: **Poland** (albo zostaw „any" — im bliżej Polski, tym
     mniejsze opóźnienia)
   - Session type: **Sticky** (ta sama IP-ka przez 10 minut — lepiej
     niż rotacja per-request, bo YouTube mniej chętnie flaguje)
   - Lifetime: **10 minutes**
   - Protocol: **HTTP**
   - Format: **user:password:host:port**
4. Skopiuj wygenerowany ciąg — coś typu
   `user-abc123-country-pl-session-xyz:hasło:geo.iproyal.com:12321`

Na VPS:

```bash
# Przekonwertuj do URL-a (kolejność: user:pass@host:port)
# Z ciągu "user:pass:host:port" zrób "http://user:pass@host:port"
PROXY_URL='http://user-abc123-country-pl-session-xyz:hasło@geo.iproyal.com:12321'

# Sanity check — connect do YouTube przez proxy
curl -sx "$PROXY_URL" -o /dev/null -w "status=%{http_code} ip=%{remote_ip}\n" https://api.ipify.org
# Oczekiwane: status=200 ip=<polski adres typu 79.184.xx.xx albo 85.140.xx.xx>
# NIE powinno być 51.75.65.32 (nasz VPS) ani adresu OVH.
```

Jak ping wyszedł z polskim domowym IP, wklej proxy do `.env`:

```bash
grep -q ^PROXY_URL /var/www/jrjr/.env \
  && sudo sed -i "s|^PROXY_URL=.*|PROXY_URL=$PROXY_URL|" /var/www/jrjr/.env \
  || echo "PROXY_URL=$PROXY_URL" | sudo tee -a /var/www/jrjr/.env

# Upewnij się że plik ma restrykcyjne uprawnienia — to hasło
sudo chmod 600 /var/www/jrjr/.env
sudo chown jrjr:jrjr /var/www/jrjr/.env
```

## Konfiguracja — Webshare

1. <https://www.webshare.io/> → Sign up → wybierz plan **Residential** (nie
   Datacenter — datacenter proxy nic nam nie dadzą, to inny zakres IP
   o tym samym problemie)
2. Po zakupie: panel → **Proxy** → **List**
3. Widzisz tabelę: `host:port:user:pass`, np. `p.webshare.io:80:abc:xyz`
4. Zbuduj URL: `http://abc:xyz@p.webshare.io:80`

Reszta jak wyżej — wklej do `.env`, restart workera.

## Test po konfiguracji

```bash
cd /var/www/jrjr
sudo -u jrjr git pull --ff-only
sudo systemctl restart jrjr-ocr
sleep 25

echo "=== LOG WORKERA ==="
sudo journalctl -u jrjr-ocr -n 40 --no-pager
```

W logu powinieneś zobaczyć:

```
[playwright] using proxy http://geo.iproyal.com:12321 (authed)
[playwright] loaded 24 cookies (auth found: SID, __Secure-1PSID, HSID, SAPISID)
[playwright] trying strategy=nocookie → https://www.youtube-nocookie.com/embed/UNAqqHIPbWA?...
[playwright] strategy=nocookie saved /tmp/jrjr-ocr-.../frame.png
[playwright] (fallback) raw text: ... 247 454 zł ... 5 851 146,29 zł ...
[playwright] amounts=X + Y = Z PLN
```

## Gdy coś dalej nie działa

- **`proxy authentication failed`** → hasło źle zdekodowane. Upewnij się
  że w PROXY_URL znaki specjalne (`@`, `:`, `/`, `%`) są URL-encoded
  (`%40`, `%3A`, `%2F`, `%25`).
- **`ECONNREFUSED`** → proxy nie odpowiada. Sprawdź, czy pakiet
  zewnętrzny nie jest wyczerpany (panel dostawcy pokaże).
- **YouTube dalej żąda logowania mimo proxy** → Google mogło wymagać
  weryfikacji konta po zmianie IP. Zaloguj się przez przeglądarkę z
  tego samego kraju proxy (np. VPN do Polski), przejdź weryfikację,
  wyeksportuj cookies **po** weryfikacji, `scp` na VPS, restart.
- **Regionalne IP flagowane** → zmień kraj w endpoint generator-ze
  (np. z PL na DE lub NL).

## Finanse

Przy domyślnych ustawieniach (1 tick / 5 min, ~5 MB per tick):

- 288 ticków / dzień
- ~1.4 GB / dzień
- 9-dniowy stream = **~13 GB**

Koszty:
- IPRoyal @ $1.80/GB = **$24** za cały event
- Webshare @ $9/2GB subscription = **$50+** (nie wystarczy pakiet, trzeba wyżej)
- Smartproxy @ $8.50/GB = **$110+** (dla całego streamu)

Dlatego zalecam IPRoyal pay-as-you-go.

## Po streamie

`sudo systemctl stop jrjr-ocr` zatrzymuje worker, koniec zużycia bandwidthu.
Proxy zostaje nieużywane do następnego razu (IPRoyal nic nie kasuje gdy
nie wysyłasz requestów).
