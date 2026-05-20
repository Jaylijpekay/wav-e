# WAV-e

WAV-e is een interne coaching-app voor een EMS-studio. De applicatie helpt trainers, management en admin met ledenopvolging, evaluatiegesprekken, stoplichtstatussen, acties, notities, trainerberichten en tablettoegang via een studio-console.

## Status

Dit project is een private Next.js-app met Supabase als auth- en datalaag. De huidige codebase bevat een werkende App Router-app, client-side dashboards, API-routes voor mutaties en een console-login voor tablets. De route `/nieuw-lid` bestaat nog als lege placeholder; leden toevoegen gebeurt in de huidige app via het trainerdashboard of managementscherm.

## Functionaliteit

### Rollen

- **Admin** beheert gebruikers, rollen, console-PINs en studio-console tokens.
- **Management** beheert trainers, leden, acties, consoletoegang en de berichten-inbox.
- **Trainer** werkt vanuit een eigen dashboard met leden, stoplichten, acties, gesprekken, urgente meldingen en berichten met management.
- **Studio-console** gebruikt een console-token plus 4-cijferige PIN voor tabletlogin zonder normale Supabase-login per trainer of managementgebruiker.

### Belangrijkste onderdelen

- Supabase Auth-login met rolgebaseerde redirects.
- Routebescherming in `src/proxy.ts`.
- HMAC-gesigneerde `console_session` cookie voor console-sessies.
- Trainerdashboard met momentumstrip, stoplichtoverzicht, open acties, ledenlijst, nieuw lid toevoegen en berichten naar management.
- Managementdashboard met studio-overzicht, trainer- en ledenbeheer, actiebeheer, PIN-beheer en console-tokenbeheer.
- Management-inbox op `/management/berichten` voor alle trainerberichten.
- Adminpaneel op `/admin` voor accountbeheer, PINs en console-tokens.
- Tabletconsole op `/console?token=...` met keuze tussen trainer en management en een grote PIN-keypad.
- Liddossier met contactmomenten, evaluaties, acties en notities.
- Evaluatieformulier op `/gesprek/new`, inclusief leefstijlscores, fysieke metingen, doelen, tevredenheid en vrije notities.
- Voortgangspagina met leefstijltrends en fysieke metingen per evaluatiecyclus.

## Lokaal opstarten

```bash
npm install
npm run dev
```

Open daarna `http://localhost:3000`.

Beschikbare scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Omgevingsvariabelen

Maak lokaal een `.env.local` met:

```text
NEXT_PUBLIC_SUPABASE_URL        Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   Supabase anon public key
SUPABASE_SERVICE_ROLE_KEY       Supabase service_role key voor server/API-routes
CONSOLE_SESSION_SECRET          Optioneel; HMAC-secret voor console_session cookies
```

Als `CONSOLE_SESSION_SECRET` ontbreekt, gebruikt `src/lib/consoleSession.ts` de service role key als fallback. `SUPABASE_SERVICE_ROLE_KEY` mag nooit in client-side code of logs terechtkomen.

## Architectuur

```text
src/
  app/
    admin/                         adminpaneel
    api/                           server-side API-routes
    components/                    Navigation en AdminBar
    console/                       tabletlogin via token + PIN
    gesprek/new/                   nieuw evaluatiegesprek
    leden/[id]/                    liddossier
    leden/[id]/evaluatie/[cyclus]/ evaluatiedetail
    leden/[id]/vooruitgang/        voortgangsoverzicht
    login/                         Supabase Auth-login
    management/                    managementdashboard
    management/berichten/          trainerberichten-inbox
    nieuw-lid/                     lege placeholder
    trainer/[trainerId]/           trainerdashboard
    trainer/[trainerId]/acties/    acties per trainer
    trainer/[trainerId]/leden/     ledenlijst per trainer
  lib/
    consoleSession.ts              HMAC console session cookie
    serverAuth.ts                  server/API auth-context en access checks
    stoplight.ts                   stoplichtlogica
    supabase.ts                    browser Supabase client
    supabase-server.ts             Supabase server client met user session
    trainerData.ts                 gedeelde trainerdashboard-data
  proxy.ts                         route guards en auth headers
```

De app gebruikt een mix van client-side Supabase reads en server-side API-routes. Nieuwe of gevoelige mutaties horen via API-routes te lopen, met `getServerAuthContext()` uit `src/lib/serverAuth.ts` voor sessie- of console-auth.

## Routes

```text
/                              startpagina; proxy redirect op basis van rol
/login                         normale Supabase-login
/admin                         adminpaneel
/management                    managementdashboard
/management/berichten          management-inbox
/console?token=...             studio-console login
/trainer/[trainerId]           trainerdashboard
/trainer/[trainerId]/acties    open acties
/trainer/[trainerId]/leden     filterbare ledenlijst
/leden/[id]                    liddossier
/leden/[id]/vooruitgang        voortgangsoverzicht
/leden/[id]/evaluatie/[cyclus] evaluatiedetail
/gesprek/new                   nieuw gesprek
/gesprek/new?lid_id=...        nieuw gesprek met lid vooringevuld
/nieuw-lid                     placeholder zonder UI
```

## API-routes

```text
/api/auth-context                         huidige rol/authMode voor navigatie
/api/admin/list                           gebruikerslijst
/api/admin/create                         trainer of managementgebruiker maken
/api/admin/delete                         gebruiker deactiveren en auth-sessie intrekken
/api/admin/pins                           PIN-overzicht
/api/admin/pin                            trainer-PIN instellen
/api/admin/pin-management                 management-PIN instellen
/api/admin/console-tokens                 admin console-tokenbeheer
/api/management/trainers                  trainer aanmaken vanuit management
/api/management/data                      managementdashboard-data
/api/management/trainers/[id]             trainer activeren/deactiveren
/api/management/leden/[id]                lid activeren/deactiveren/status wijzigen
/api/management/console-tokens            management console-tokenbeheer
/api/management/console-tokens/[id]       console-token wijzigen of verwijderen
/api/trainer/[trainer_id]/dashboard       trainerdashboard-data
/api/trainer/[trainer_id]/leden           trainerleden ophalen of lid toevoegen
/api/trainer/[trainer_id]/acties          acties voor trainer
/api/trainer/[trainer_id]/next-lid-id     volgend lidnummer via RPC
/api/leden/[id]                           lid, evaluaties en contactmomenten ophalen
/api/gesprek                              evaluatie opslaan
/api/gesprek/leden                        actieve leden voor gesprekformulier
/api/contact                              contactmoment opslaan
/api/acties                               acties ophalen of aanmaken
/api/acties/[id]                          actie afronden of wijzigen
/api/notities/[lid_id]                    lidnotities ophalen of aanmaken
/api/notities/[lid_id]/[notitie_id]       notitie soft-deleten of als gezien markeren
/api/trainer-notities                     management-inbox aggregate
/api/trainer-notities/[trainer_id]        thread ophalen of bericht plaatsen
/api/trainer-notities/[trainer_id]/[notitie_id] bericht soft-deleten
/api/console/validate                     console-token valideren en cookie zetten
/api/console/people                       trainers en management voor consolekeuze
/api/console/verify-pin                   PIN controleren en console_session zetten
/api/console/refresh                      console_session verversen
/api/console/logout                       console_session wissen
```

## Auth en toegang

- Browser-login gebruikt `getSupabase()` uit `src/lib/supabase.ts`.
- Server/API-auth loopt via `getServerAuthContext(req)` uit `src/lib/serverAuth.ts`.
- Console-auth gebruikt eerst een `console_token` cookie, daarna een HMAC-gesigneerde `console_session` cookie.
- `src/proxy.ts` laat publieke console- en loginroutes door, controleert console-sessies zonder databasecall en valt daarna terug op Supabase session auth.
- Adminroutes worden in de proxy momenteel gated op de hardcoded `ADMIN_UUID`.
- Managementroutes vereisen rol `management` of de admin UUID.
- Trainer-console-sessies mogen alleen naar hun eigen trainerroute, `/gesprek` en `/leden/[id]`.

## Leden, acties en gesprekken

Leden kunnen worden toegevoegd via:

- het trainerdashboard: `POST /api/trainer/[trainer_id]/leden`;
- het managementdashboard: via de bestaande management UI en Supabase/API-mutaties.

Acties kunnen aan een lid of direct aan een trainer gekoppeld zijn. Open acties verschijnen op het trainerdashboard en de actiespagina. Afgeronde acties tellen mee in de momentumstrip van de huidige maand.

Een nieuw gesprek wordt opgeslagen via `POST /api/gesprek`. De server bepaalt de volgende `cyclus` op basis van bestaande evaluaties voor dat lid.

## Notities en berichten

Er zijn twee aparte notitiestromen:

- **Lidnotities** in `notities`, gekoppeld aan een lid en optioneel zichtbaar als urgente melding voor de trainer.
- **Trainerberichten** in `trainer_notities`, gebruikt als tweerichtings-thread tussen trainer en management.

Managementnotities met `toon_aan_trainer = true` en `gezien = false` verschijnen op het trainerdashboard. Trainers kunnen deze als gezien markeren via `PATCH /api/notities/[lid_id]/[notitie_id]`.

Trainerberichten worden gelezen en beantwoord via `/management/berichten`. De thread-route markeert management-leesstatus bij het ophalen van een trainerthread.

## Stoplichtlogica

De stoplichtstatus gebruikt de meest recente datum uit contactmomenten en evaluaties:

```text
Groen  contact binnen 14 dagen
Oranje 15 t/m 28 dagen
Rood   29 dagen of langer, of geen contact bekend
```

De implementatie staat in `src/lib/stoplight.ts`.

## Technische stack

- Next.js `16.2.3` met App Router
- React `19.2.4`
- TypeScript `^5`
- Supabase Auth, database en RPC's
- `@supabase/ssr` `^0.10.2`
- `@supabase/supabase-js` `^2.103.0`
- `qrcode.react` `^4.2.0`
- Tailwind CSS `^4` wordt globaal geimporteerd in `src/app/globals.css`
- ESLint `^9` met `eslint-config-next`

De UI gebruikt vooral inline styles, lokale `<style>`-blokken en CSS design tokens in `src/app/globals.css`.

## Supabase

Tabellen die in de huidige code worden gebruikt:

```text
acties
console_tokens
contact_momenten
evaluaties
leden
management_gebruikers
notities
trainer_notities
trainers
user_roles
```

RPC's die in de huidige code worden aangeroepen:

```text
get_my_role
get_my_trainer_id
get_next_lid_id
validate_console_token
touch_console_token
set_trainer_pin
set_management_pin
verify_trainer_pin
verify_management_pin
```

## Bekende aandachtspunten

- `/nieuw-lid` is nog een lege placeholder.
- De proxy redirectt trainers vanaf `/` naar `/leden`, maar er is geen `src/app/leden/page.tsx`; de trainerflow gebruikt normaal `/trainer/[trainerId]`.
- `ADMIN_UUID` staat hardcoded in `src/proxy.ts`.
- Er staan nog enkele mojibake-tekens in comments en UI-strings uit eerdere encodingproblemen.
- De pagina-comments zijn niet overal actueel; de code en deze README zijn leidend.
