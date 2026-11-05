# Átállás saját domainre: dankuchenkaposvar.hu

> **Állapot (2026-11-05): végrehajtva, az oldal nyilvános a `https://dankuchenkaposvar.hu` címen, a jelszóvédelem le van véve.** A végleges beállítás a `deploy/apache-dankuchen.conf` fájlban van. Az 5. fejezet pontjai közül a phpMyAdmin tiltása kész, a többi még nyitott.

## Kontextus

Az oldal most a webáruház virtual hostjában, a `fabutorwebaruhaz.hu/dankuchen` alútvonalon fut, jelszóval védve. A cél, hogy a `dankuchenkaposvar.hu` domainről érkező kéréseket ugyanezen a VPS-en egy saját virtual host szolgálja ki, a domain gyökerében.

**Nem változik:** a Node-szolgáltatás, a port (4322), az adatbázis, a jelszófájl, a `/var/www/dankuchen` és az `/opt/dankuchen` mappa, a tűzfal. A szükséges Apache-modulok (`ssl`, `rewrite`, `proxy_http`, `headers`) már be vannak kapcsolva. A backend kódjához sem kell nyúlni, mert az útvonal végét nézi.

## 1. Előfeltétel: domain és DNS

A rekordok 2026. november 5-én már éltek. Nélkülük tanúsítvány sem kérhető.

| Rekord | Név | Érték |
|---|---|---|
| A | `dankuchenkaposvar.hu` | `185.51.188.178` |
| A | `www.dankuchenkaposvar.hu` | `185.51.188.178` |

AAAA rekord ne legyen, mert a szervernek nincs nyilvános IPv6-címe.

## 2. Módosítások a repóban

| Fájl | Módosítás |
|---|---|
| `deploy/telepit.sh` | A build `BASE_PATH=/dankuchen` nélkül készül, az ellenőrző hívás a `/api/szabad-idopontok` címre megy. Az `SZERVER=root@fabutorwebaruhaz.hu` marad, mert az SSH-hoz ez a szerver neve. |
| `frontend/astro.config.mjs` | `site: 'https://dankuchenkaposvar.hu'`, a megjegyzések frissítése |
| `frontend/src/content/szovegek/adatkezeles.md` | A 10. és 12. sorban a domain jelenleg `dankuchenexkluzivstudio-kaposvar.hu`, ezt át kell írni. A „Hatályos” dátum is frissül. |
| `deploy/apache-dankuchen.conf` | A mostani részlet helyett a teljes virtual host (lásd lent) |
| `README.md` | Az ábra, a telepítés, az éles indulás, a `/dankuchen` előtag említései (kb. 22 sor) |

A `url()` segédfüggvény és a linkek nem változnak, ezek a `base` értékét követik.

## 3. Módosítások a szerveren

### Új virtual host: `/etc/apache2/sites-available/zz-dankuchenkaposvar.hu.conf`

**A `zz-` előtag fontos.** Az Apache betűrendben tölti be a fájlokat, és a név nélküli vagy ismeretlen domainű kéréseket az első virtual host kapja. Egy `dankuchen…` nevű fájl a `default-ssl.conf` elé kerülne, így ezek a kérések a webáruház helyett a konyhás oldalra futnának.

```apache
<VirtualHost *:80>
    ServerName dankuchenkaposvar.hu
    ServerAlias www.dankuchenkaposvar.hu
    RewriteEngine On
    RewriteRule ^ https://dankuchenkaposvar.hu%{REQUEST_URI} [END,NE,R=permanent]
    ErrorLog ${APACHE_LOG_DIR}/dankuchen-error.log
    CustomLog ${APACHE_LOG_DIR}/dankuchen-access.log geocombined
</VirtualHost>

<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName dankuchenkaposvar.hu
    ServerAlias www.dankuchenkaposvar.hu
    DocumentRoot /var/www/dankuchen

    # A www változat a domain gyökerére irányít.
    RewriteEngine On
    RewriteCond %{HTTP_HOST} ^www\. [NC]
    RewriteRule ^ https://dankuchenkaposvar.hu%{REQUEST_URI} [END,NE,R=permanent]

    <Directory /var/www/dankuchen>
        Options -Indexes -MultiViews +FollowSymLinks
        AllowOverride None
        DirectoryIndex index.html
        AddType image/webp .webp
        AddType font/woff2 .woff2
        Require all granted
    </Directory>

    # Az időpontfoglaló API (Node, csak helyben érhető el).
    ProxyPass        /api/ http://127.0.0.1:4322/api/
    ProxyPassReverse /api/ http://127.0.0.1:4322/api/

    # Teszt alatt jelszóval védve, éles induláskor törlendő.
    <Location />
        AuthType Basic
        AuthName "DANKUCHEN Kaposvar"
        AuthUserFile /etc/apache2/.htpasswd-dankuchen
        Require valid-user
    </Location>

    ErrorLog ${APACHE_LOG_DIR}/dankuchen-error.log
    CustomLog ${APACHE_LOG_DIR}/dankuchen-access.log geocombined

    SSLEngine on
    Include /etc/letsencrypt/options-ssl-apache.conf
    SSLCertificateFile /etc/letsencrypt/live/dankuchenkaposvar.hu/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/dankuchenkaposvar.hu/privkey.pem
</VirtualHost>
</IfModule>
```

A naplókat a meglévő logrotate-szabály (`/var/log/apache2/*.log`) kezeli.

### Tanúsítvány

Külön tanúsítvány kell. A webáruházét ne bővítsük ezzel a domainnel, mert akkor a két oldal tanúsítványa összekapcsolódna.

```sh
certbot certonly --apache -d dankuchenkaposvar.hu -d www.dankuchenkaposvar.hu \
  --deploy-hook "systemctl reload apache2"
```

A `certbot.timer` már fut, így a megújítás automatikus lesz. A tanúsítvány kéréséhez a 80-as virtual hostnak már élnie kell, ezért a 443-as rész csak utána kerülhet be.

### A régi útvonal: `/etc/apache2/sites-available/default-ssl.conf`

Az `Alias /dankuchen`, a `<Directory /var/www/dankuchen>`, a `ProxyPass /dankuchen/api` és a `<Location /dankuchen/api>` blokk helyett egyetlen sor:

```apache
RedirectMatch 301 ^/dankuchen(/.*)?$ https://dankuchenkaposvar.hu$1
```

## 4. Végrehajtási sorrend

1. DNS beállítása, megvárni, amíg a domain a szerverre mutat.
2. A repó módosításai, `npm test`, build helyben.
3. A `default-ssl.conf` és a `le-redirect` mentése. A virtual host felvétele csak a 80-as résszel, `a2ensite`, `apache2ctl configtest`, `systemctl reload apache2`.
4. Tanúsítvány kérése, a 443-as rész hozzáadása, `configtest`, reload.
5. A váltás egy lépésben: `deploy/telepit.sh` (az új, gyökérre épített build), és a régi útvonal cseréje az átirányításra, `configtest`, reload. Az új build a régi címen már nem működne, ezért ez a kettő összetartozik.
6. Próba a `https://dankuchenkaposvar.hu` címen, még jelszóval.
7. Éles indulás: a `<Location />` blokk törlése, `configtest`, reload.

Az Apache-ot ez a webáruházzal együtt érinti, ezért minden újratöltés előtt `configtest` kell. A graceful reload nem szakítja meg a futó kéréseket.

## 5. Éles indulás előtt érdemes rendezni

- **phpMyAdmin:** a `/phpmyadmin` alias szerverszintű, ezért az új domainen is élne. Az új virtual hostban egy `<Location /phpmyadmin>` blokk tiltja (kész). A `fabutorwebaruhaz.hu/phpmyadmin/` címen továbbra is nyilvános.
- **DKIM:** az `fws._domainkey.lamello.hu` kulcs hiányzik, ezért a visszaigazoló levelek az Outlookban spambe kerülhetnek. Ez a valódi látogatókat is érinti.
- **Adatkezelési tájékoztató:** három helyen még a régi telefonszám (`+36 20 473 2443`) szerepel, és jogi felülvizsgálat sem történt.
- **Nyilvános foglalás:** a jelszó levétele után bárki foglalhat, és robotok is megtalálják az oldalt. A védelmek (rejtett mező, IP-korlát, foglalási korlát) élnek, de egy automatikus jóváhagyás nélküli rendszernél érdemes figyelni az első napokat.
- **Lemez:** 2026. november 5-én 80%-os volt, a `/swapfile2` és a nyilvánosan letölthető `mylog.txt`, `uploads2.zip` kérdése akkor még nyitott volt.

## 6. Választások, amelyeket így vettem alapul

- **A főcím a `dankuchenkaposvar.hu`,** a `www` változat ide irányít.
- **A jelszó a próba végéig marad,** az éles indulás külön lépés.
- **A német IP-tiltás nem kerül át** az új virtual hostba. Ez a webáruház szabálya, és virtual hostonként külön érvényes. Ha a konyhás oldalra is kell, két sorral felvehető.
- **E-mail:** a levelek továbbra is `lamello.hu`-s címről mennek. A `dankuchenkaposvar.hu` domainhez nem kell MX vagy SPF rekord. A `szerverNev` már erre a domainre van állítva, és a DNS beállítása után ez érvényes név lesz.

## 7. Ellenőrzés

1. `apache2ctl -S`: az alapértelmezett virtual host (az első a listában) továbbra is a `fabutorwebaruhaz.hu`, a `dankuchenkaposvar.hu` külön névvel szerepel.
2. `https://fabutorwebaruhaz.hu/`: 200, webáruház változatlan, a saját tanúsítványával.
3. `curl -I` a következőkre: `http://dankuchenkaposvar.hu/` és `https://www.dankuchenkaposvar.hu/` a `https://dankuchenkaposvar.hu/` címre irányít, `https://fabutorwebaruhaz.hu/dankuchen/konyhak/` a `https://dankuchenkaposvar.hu/konyhak/` címre.
4. Az oldal forrásában nincs `/dankuchen/` hivatkozás, a képek, a fontok és a katalógus betöltődnek.
5. `/api/szabad-idopontok` válaszol, a tanúsítvány a `dankuchenkaposvar.hu` névre szól.
6. Valódi foglalás a böngészőből: megérkezik a levél, az óra eltűnik a listából. Ez valódi levelet küld, ezért a próbát a tulajdonos végzi.

## Visszaállítás

A mentett `/root/apache-mentes-20261105/default-ssl.conf` visszamásolása, `a2dissite zz-dankuchenkaposvar.hu`, reload, majd a régi build visszatöltése. Az utolsó `/dankuchen` előtagú build a `/root/dankuchen-mentes-20261105-1458` mappában van, de a `telepit.sh` csak az 5 legutóbbi mentést tartja meg, ezért idővel törlődik. Utána `BASE_PATH=/dankuchen npm --prefix frontend run build` készít újat.

A jelszóvédelem visszakapcsolásához a `/root/apache-mentes-20261105/zz-dankuchenkaposvar.hu.conf.jelszoval` fájlt kell visszamásolni a virtual host helyére, majd `configtest` és reload. Ebben a változatban nincs phpMyAdmin-tiltás, de a jelszó ott is védi.
