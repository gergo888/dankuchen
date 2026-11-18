# A fejlesztés költöztetése a VPS-re

> **Állapot (2026-11-18): szünetel.** A repó egyelőre a saját gépen marad, ott folyik a fejlesztés, és a frontend telepítése is onnan indul. A költöztetés előkészítése kész, egy dolog akadályozza: a VPS processzora nem tudja futtatni a képfeldolgozó `sharp` csomagot, ezért ott nem készül el a frontend buildje. Ha a szolgáltató modernebb processzortípust ad a gépnek, a 4. fejezet szerint újra lehet próbálni.

## Kontextus

A cél: a repó a VPS-en legyen (`fabutorwebaruhaz.hu`, 2222-es SSH-port), ott fusson a fejlesztés és a telepítés. A fejlesztői szervereket (Astro: 4321, backend: 4322) a saját gépről SSH-alagúton lehet elérni.

## 1. Ami elkészült, és élesben van

| Mi | Állapot |
|---|---|
| Az éles backend portja | **4330**, a 4322 helyett (`deploy/dankuchen.service`, `deploy/apache-dankuchen.conf`). A 4321 és a 4322 a fejlesztői szervereké, így a fejlesztői Astro proxyja véletlenül sem érheti el az éles backendet. |
| `deploy/telepit.sh` | Két módban fut. Ha létezik a `/etc/systemd/system/dankuchen.service`, helyben telepít, `sudo`-val, mert az `ubuntu` felhasználó jelszó nélkül sudo-zhat. Máshol SSH-n át telepít, mint eddig. Induláskor kiírja a módot. |
| `frontend/astro.config.mjs` | A fejlesztői szerver rögzítetten a `127.0.0.1:4321` címen figyel. A VPS-en a `localhost` az IPv6-os `::1`-re oldódik fel, és akkor az alagút nem érné el. |
| README | „Fejlesztés a VPS-en” szakasz: az alagút parancsa és `~/.ssh/config` minta. |
| Klón a VPS-en | `/home/ubuntu/dankuchen`, az `ubuntu` felhasználóé, a `151f7a4` állapotban, telepített függőségekkel. Most nincs használatban. |

2026-11-18-án kipróbálva:
- a VPS-en mind a 49 backend-teszt átment;
- a fejlesztői szerverek alagúton elérhetők voltak, és a fejlesztői backend a saját adatbázisát használta;
- a `telepit.sh backend` a VPS-ről (helyi mód) és a saját gépről (SSH-s mód) is működött.

## 2. Az akadály: a VPS processzora

A VPS virtuális processzora „Common KVM processor” (Ubuntu 22.04). Ez egy régi alapmodell: a `/proc/cpuinfo` szerint nincs benne SSE4.1, SSE4.2 és POPCNT. Következmények:

- A `sharp` 0.35 (az Astro képfeldolgozója) natív változata legalább x86-64-v2 processzort kér, ezért elutasítja: „Prebuilt binaries for Linux x64 require v2 microarchitecture”.
- A WebAssembly-tartalék (`@img/sharp-wasm32`) sem fut, mert SIMD-utasítások kellenének hozzá: „Wasm SIMD unsupported”.
- Forrásból fordítani nem érdemes: a `sharp`-nak libvips 8.17 kell, az Ubuntu 22.04-ben 8.12 van.

Emiatt a VPS-en:
- **nem működik:** a frontend buildje (`npm run build`, `deploy/telepit.sh frontend`), mert a szkript a build hibájánál megáll, és nem tölt fel semmit;
- **nem működik:** a képek feldolgozása a fejlesztői szerveren;
- **működik:** minden más, vagyis az oldalak, az API, az admin, a tesztek és a backend telepítése.

## 3. Ami addig érvényes

- A fejlesztés a saját gépen folyik (`npm run dev`, http://localhost:4321).
- A telepítés a saját gépről indul. A `deploy/telepit.sh` ott SSH-s módban fut, és a frontend buildje is ott készül.
- A VPS-en lévő klón nincs használatban. Megmaradhat, vagy törölhető (`/home/ubuntu/dankuchen`, kb. 230 MB).

## 4. Újrapróbálás

1. **Processzortípus:** a szolgáltatótól (Tárhely.Eu) azt kell kérni, hogy a VPS processzortípusa „host-passthrough” legyen, vagy legalább „x86-64-v2”. Ehhez a VPS újraindul, ami a webáruházat is érinti pár percre.
2. **Ellenőrzés a VPS-en:**
   ```sh
   grep -m1 -owE 'sse4_2|popcnt' /proc/cpuinfo | sort -u            # mindkettőnek meg kell jelennie
   sudo -iu ubuntu bash -c 'cd ~/dankuchen/frontend && node -e "require(\"sharp\"); console.log(\"sharp rendben\")"'
   ```
3. **A klón frissítése** az `ubuntu` felhasználóként:
   ```sh
   cd ~/dankuchen && git pull && npm run setup && npm test && npm run build
   ```
4. **A frontend telepítése a VPS-ről:** `deploy/telepit.sh frontend`. A kiírásban „Telepítés helyben” kell álljon, utána az élő oldalt ellenőrizni kell.
5. **Fejlesztés alagúton,** a README „Fejlesztés a VPS-en” szakasza szerint. A képeknek is meg kell jelenniük a http://localhost:4321 címen.
6. **Pusholás a VPS-ről:** az `ubuntu` felhasználó SSH-kulcsát fel kell venni a GitHubra, a távoli címet SSH-ra kell állítani (`git remote set-url origin git@github.com:gergo888/dankuchen.git`), és be kell állítani a git nevet és e-mail-címet.
7. **Ezt a fájlt** és a README-t frissíteni kell az új állapotra.

Ha a szolgáltató nem tud modernebb processzort adni, két kerülőút marad:
- a frontendet továbbra is a saját gépen buildelni;
- a buildet és a telepítést egy CI-ra bízni, például GitHub Actionsre, modern processzorral.

A fejlesztői szerveren a képek ekkor is csak feldolgozás nélkül jelenhetnének meg, ehhez egy fejlesztési beállítás kellene az `astro.config.mjs`-ben.
