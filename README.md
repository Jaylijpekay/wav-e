# WAV-e

WAV-e is een coaching-intelligentielaag voor een EMS-studio. De app helpt trainers, management en admin bij het volgen van leden, coachingcycli, contactmomenten, acties, notities en studio-consoletoegang.

## 1. Wat zit er in de app?

### Rollen en toegang

- **Admin**: beheert gebruikers, rollen, PIN-codes en studio-consoles.
- **Management**: ziet het studio-overzicht, beheert trainers en leden, wijst acties toe, schrijft notities en leest de berichten-inbox van trainers.
- **Trainer**: werkt vanuit een eigen dashboard met leden, gesprekken, open acties, urgente meldingen en een tweerichtings-berichtenthread met management.
- **Studio-console**: iPad/tablet-login via console-token en 4-cijferige PIN, zonder normale Supabase-login per trainer.

Rollen worden uitsluitend afgeleid via de `get_my_role()` RPC. De admin-superuser wordt naast de RPC in `src/proxy.ts` als bootstrap-check gebruikt.

### Belangrijkste functies

- Supabase Auth login met rolgebaseerde redirects.
- Proxy-routebescherming voor admin, management, trainer en console-routes.
- Trainerdashboard met stoplichtoverzicht, momentumstrip, snelle start voor gesprekken, open acties, ledenlijst en nieuw lid toevoegen.
- Momentumstrip op trainerdashboard met gesprekken en afgeronde acties van de huidige maand.
- Urgente notities van management verschijnen als melding op het trainerdashboard.
- Tweerichtings-berichtenthread tussen trainer en management, zichtbaar op het trainerdashboard en in de management-inbox.
- Managementdashboard met studio-aantallen, trainerstatistieken, ledenfilters, actie-toewijzing, notities en consolebeheer.
- Management-inbox `/management/berichten` met alle trainerberichten, ongelezen eerst, met inline antwoord.
- Adminpaneel voor gebruikersbeheer, PIN-beheer en studio-consolebeheer.
- Console-tokenbeheer met QR-code en kopieerbare console-URL.
- Tabletvriendelijke console-login met keuze tussen trainer en management, personenlijst en grote PIN-keypad.
- Ledenprofiel met contactgegevens, evaluaties, contactmomenten, gezondheidsignalen, open acties en notities.
- Open acties per trainer, inclusief management-acties zonder lidkoppeling, deadlines en verlopen status.
- Filterbare ledenlijst per trainer op stoplichtstatus en zoekterm.
- Nieuwe evaluatiegesprekken met leefstijl-scores, fysieke metingen, doelen, tevredenheid en notities. De `cyclus` wordt server-side berekend.
- Vooruitgangspagina met leefstijl-grafieken, cycli, ringen en fysieke metingen over tijd.

## 2. Lokaal opstarten

1. Clone de repository.
2. Installeer dependencies:

```bash
npm install
```

3. Maak `.env.local` aan met de Supabase-waarden uit sectie 3.
4. Start de ontwikkelserver:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

Beschikbare scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## 3. Benodigde omgevingsvariabelen

```text
NEXT_PUBLIC_SUPABASE_URL        - Supabase dashboard > Project Settings > API > Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   - Supabase dashboard > Project Settings > API > anon public key
SUPABASE_SERVICE_ROLE_KEY       - Supabase dashboard > Project Settings > API > service_role key
```

Let op: `SUPABASE_SERVICE_ROLE_KEY` is geheim en mag nooit naar client-side code of publieke logs lekken. Deze key wordt server-side gebruikt door API-routes en door `src/proxy.ts` voor console-tokenvalidatie.

Auth-architectuur:

- Client-side pagina's gebruiken `getSupabase()` uit `src/lib/supabase.ts` met de anon key.
- Server-side API-routes gebruiken `createServerClient` uit `@supabase/ssr` met de service role key en valideren de gebruiker via `auth.getUser()` plus de `get_my_role()` RPC.

## 4. Mappenstructuur

```text
src/
  app/
    admin/                         - adminpaneel voor gebruikers, PINs en console-tokens
    api/admin/create/              - nieuwe gebruiker (trainer of management)
    api/admin/delete/              - soft-deactiveert trainer/management en wist auth-sessie
    api/admin/list/                - gebruikerslijst voor adminpaneel
    api/admin/pin/                 - PIN instellen voor trainer
    api/admin/pin-management/      - PIN instellen voor management
    api/admin/pins/                - lijst met trainers en management voor PIN-beheer
    api/admin/console-tokens/      - console-tokens aanmaken, intrekken, heractiveren
    api/console/validate/          - console-token valideren en cookie zetten
    api/console/people/            - trainers en management voor console-keuze
    api/console/verify-pin/        - PIN-validatie voor console-login
    api/gesprek/                   - nieuw gesprek opslaan; cyclus wordt server-side bepaald
    api/notities/[lid_id]/         - lidnotities ophalen en aanmaken
    api/notities/[lid_id]/[notitie_id]/   - lidnotitie verwijderen of als gezien markeren
    api/trainer-notities/          - inbox-aggregate van alle trainerberichten (management)
    api/trainer-notities/[trainer_id]/                  - berichtenthread per trainer
    api/trainer-notities/[trainer_id]/[notitie_id]/     - bericht verwijderen
    components/                    - gedeelde Navigation- en AdminBar-componenten
    console/                       - tablet-login via console-token en PIN
    gesprek/new/                   - nieuw evaluatiegesprek vastleggen
    leden/[id]/                    - liddossier
    leden/[id]/evaluatie/[cyclus]/ - evaluatiedetail per cyclus
    leden/[id]/vooruitgang/        - voortgangsgrafieken en fysieke metingen
    login/                         - Supabase Auth login
    management/                    - managementdashboard
    management/berichten/          - management-inbox voor trainerberichten
    nieuw-lid/                     - placeholder; leden aanmaken loopt via management of trainerdashboard
    trainer/[trainerId]/           - trainerdashboard
    trainer/[trainerId]/acties/    - open acties per trainer
    trainer/[trainerId]/leden/     - filterbare ledenlijst per trainer
  lib/
    stoplight.ts                   - stoplichtlogica en contactdatumhelpers
    supabase.ts                    - client-side Supabase client (anon key)
    supabase-server.ts             - server-side Supabase client (gebruikers-sessie)
  proxy.ts                         - routebescherming, role checks en console-token cookie
```

## 5. Belangrijke routes

```text
/login                         - normale login
/admin                         - adminpaneel
/management                    - managementdashboard
/management/berichten          - inbox met alle trainerberichten
/console?token=...             - studio-console login
/trainer/[trainerId]           - trainerdashboard
/trainer/[trainerId]/acties    - open acties
/trainer/[trainerId]/leden     - mijn leden
/leden/[id]                    - liddossier
/leden/[id]/vooruitgang        - voortgangsoverzicht
/leden/[id]/evaluatie/[cyclus] - evaluatiedetail
/gesprek/new                   - nieuw gesprek
/gesprek/new?lid_id=...        - nieuw gesprek met lid vooringevuld
```

## 6. Een nieuw lid toevoegen

Via management:

1. Log in als management.
2. Ga naar `/management`.
3. Klik op `+ Lid toevoegen`.
4. Vul Lid-ID, voornaam, achternaam, startdatum en trainer in.
5. Vul eventueel e-mail en telefoon in.
6. Klik op `Lid toevoegen`.

Via het trainerdashboard:

1. Log in als trainer of gebruik de studio-console.
2. Ga naar het trainerdashboard.
3. Klik op `Nieuw lid`.
4. Vul Lid-ID, voornaam, achternaam en startdatum in.
5. Vul eventueel e-mail en telefoon in.
6. Klik op `Lid toevoegen`.

Bij toevoegen via het trainerdashboard wordt het lid automatisch aan die trainer gekoppeld en actief gezet.

## 7. Een nieuwe trainer of managementgebruiker toevoegen

Via admin:

1. Log in als admin.
2. Ga naar `/admin`.
3. Klik op `+ Nieuwe gebruiker`.
4. Vul voornaam, achternaam, e-mail en wachtwoord in.
5. Kies de rol `Trainer` of `Management`.
6. Klik op `Aanmaken`.

Via management kan ook een trainer worden toegevoegd:

1. Log in als management.
2. Ga naar `/management`.
3. Klik bij `Trainers` op `+ Trainer toevoegen`.
4. Vul voornaam, achternaam, e-mail en wachtwoord in.
5. Klik op `Trainer toevoegen`.

Een trainer of managementgebruiker krijgt daarna apart een console-PIN via het adminpaneel.

Deactiveren gaat via admin `Verwijder` of via management `Deactiveer`. De auth-sessie wordt ingetrokken en het profiel komt op `actief = false`; bestaande data van leden, gesprekken en notities blijft bewaard.

## 8. Studio-console instellen

1. Log in als admin.
2. Ga naar `/admin`.
3. Open `Studio consoles`.
4. Klik op `+ Nieuwe console`.
5. Geef het apparaat een naam, bijvoorbeeld `iPad Studio Vloer`.
6. Maak het token aan.
7. Scan de QR-code met de tablet of kopieer de console-URL.
8. Stel voor trainers en managementgebruikers een 4-cijferige PIN in bij `Console PINs`.

De console gebruikt een token in de URL of een `console_token` cookie. Na validatie kan de gebruiker kiezen tussen trainer en management en daarna met PIN inloggen.

## 9. Werken met acties

Acties kunnen aan leden of direct aan een trainer worden gekoppeld.

- Management kan vanuit het managementdashboard acties toewijzen aan een trainer en eventueel een lid.
- Trainerdashboards tonen open acties in de tegel `Open acties`.
- De pagina `/trainer/[trainerId]/acties` groepeert acties per management en per lid.
- Deadlines worden getoond; verlopen acties krijgen een urgentere weergave.
- In het liddossier kan een open actie als afgerond worden gemarkeerd.
- Afgeronde acties tellen mee in de momentumstrip van de huidige maand.

## 10. Notities en berichten

WAV-e heeft twee gescheiden tabellen voor notities en berichten:

- **Lidnotities** (`notities`): gekoppeld aan een lid en zichtbaar in het liddossier. Optioneel ook aan een specifieke evaluatiecyclus gekoppeld. Management kan een notitie als `urgent` aan de trainer tonen.
- **Trainerberichten** (`trainer_notities`): gekoppeld aan een trainer en zichtbaar als tweerichtings-thread tussen management en trainer.

Lidnotities:

- Trainer, management en admin kunnen notities bij een lid plaatsen via het liddossier.
- Een management-notitie met `toon_aan_trainer = true` verschijnt als `Urgente melding` op het trainerdashboard.
- De trainer markeert urgente notities als gezien; de notitie blijft daarna in het liddossier zichtbaar.

Trainerberichten:

- Trainers schrijven berichten vanaf hun dashboard.
- Management leest en beantwoordt berichten via `/management/berichten`. Ongelezen berichten komen bovenaan, daarbinnen nieuwste eerst. Bij het openen van een trainer-thread worden de berichten als gelezen gemarkeerd (`gelezen_door_management = true`).
- Op het managementdashboard staat per trainer een unread-counter naast de naam; het totaal verschijnt op de knop `Berichten`.

## 11. Evaluaties en voortgang

Een nieuw gesprek wordt server-side via `POST /api/gesprek` opgeslagen. De `cyclus` wordt daar bepaald als het huidige aantal evaluaties voor dat lid plus één. De trainer vult onder andere in:

- slaap, energie, stress, voeding, beweging en motivatie;
- gewicht, vetpercentage en spiermassa;
- doelen behaald: ja, nee of n.v.t.;
- interne tevredenheidsscore;
- vrije notities.

Het liddossier toont de nieuwste scores als gezondheidsignalen. De voortgangspagina toont cycli, leefstijltrends en fysieke metingen over tijd.

## 12. Hoe werkt het stoplicht?

Het stoplicht kijkt naar de meest recente datum uit contactmomenten en evaluaties.

```text
Groen  - contact binnen 14 dagen
Oranje - 15 tot en met 28 dagen
Rood   - 29 dagen of langer, of geen contact bekend
```

Deze logica staat in `src/lib/stoplight.ts` en wordt gebruikt in management, trainerdashboards, ledenlijsten en liddossiers.

## 13. Technische stack

- Next.js `16.2.3` (App Router, Server Components)
- React `19.2.4`
- TypeScript `^5`
- Supabase Auth, database en RPC's
- `@supabase/ssr` `^0.10.2` voor proxy- en server-side clients
- `@supabase/supabase-js` `^2.103.0`
- `qrcode.react` `^4.2.0` voor console-token QR-codes
- ESLint `^9` met `eslint-config-next`

Styling gebeurt uitsluitend via inline styles en `<style>`-blokken per pagina. Tailwind staat als devDependency in `package.json` (`tailwindcss ^4`, `@tailwindcss/postcss ^4`), maar wordt niet als active styling-laag in de applicatie gebruikt.

Database-tabellen in Supabase:

```text
acties, console_tokens, contact_momenten, evaluaties, leden,
management_gebruikers, notities, trainer_notities, trainers, user_roles
```

Belangrijke RPC's:

```text
get_my_role, get_my_trainer_id, get_next_lid_id,
validate_console_token, touch_console_token,
set_trainer_pin, set_management_pin,
verify_trainer_pin, verify_management_pin
```

## 14. Bekende aandachtspunten

1. iPad Safari login via session cookie heeft geen device-test gehad na de laatste auth-rebuild. Bart moet als eerste handover-stap inloggen op het echte apparaat.
2. De admin-superuser UUID staat nog in `src/proxy.ts` als bootstrap-check naast de `get_my_role()` RPC. Dit is gedocumenteerde technische schuld — niet kritisch, maar staat gepland voor v0.1.2.
3. Claude Code versies v2.1.100 en hoger hebben een bekende token-inflatie bug (~40% extra verbruik). Downgrade naar v2.1.34 of installeer opnieuw via npm als workaround totdat Anthropic een fix uitbrengt.
4. Integraties met Onlineafspraken.nl, Google Calendar en WhatsApp Business API zijn gepland voor v0.2 en nog niet geïmplementeerd.
5. De `trainers.rol` kolom bestaat in de database maar wordt niet meer beschreven door de applicatie — de rollogica loopt via de `user_roles` tabel en de `get_my_role()` RPC.
