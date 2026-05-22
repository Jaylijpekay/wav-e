# WAV-e

WAV-e is een private interne coaching-app voor een EMS-studio. De app ondersteunt trainers, management en admin bij ledenopvolging, evaluatiegesprekken, acties, notities, berichten en tablettoegang via een studio-console.

De codebase is een Next.js App Router-app met Supabase voor auth, database, RPC's en server-side mutaties.

## Huidige Status

- Next.js `16.2.3` met App Router en React `19.2.4`.
- Supabase Auth voor normale browser-login.
- HMAC-gesigneerde console-sessies voor tabletgebruik zonder normale login per gebruiker.
- UI bestaat vooral uit client components met inline styles en globale design tokens in `src/app/globals.css`.
- Mutaties lopen via API-routes onder `src/app/api`.
- `/nieuw-lid` bestaat als route maar is inhoudelijk nog een placeholder. Leden toevoegen gebeurt in de praktijk via trainerdashboard of management.
- Er staan nog enkele mojibake-tekens in oude comments en UI-strings. Deze README beschrijft de huidige bedoelde functionaliteit.

## Rollen

### Admin

Admin beheert gebruikers en toegang:

- trainer- en managementaccounts aanmaken;
- gebruikers deactiveren/verwijderen via admin API;
- trainer-PINs en management-PIN instellen;
- console-tokens beheren;
- adminpaneel openen via `/admin`.

De proxy gebruikt momenteel een hardcoded `ADMIN_UUID` in `src/proxy.ts` voor adminroute-gating.

### Management

Management beheert studio-operatie:

- studio-overzicht met trainers, ledenstatussen en acties;
- trainers activeren/deactiveren;
- leden activeren, deactiveren, stoppen, heractiveren en herverdelen;
- leden aanmaken;
- acties aan trainers of leden koppelen;
- lidnotities maken, eventueel zichtbaar voor trainer;
- berichten van trainers lezen via `/management/berichten`;
- antwoorden naar trainer sturen;
- console-tokens en PINs beheren.

### Trainer

Trainer werkt vanuit `/trainer/[trainerId]`:

- momentumstrip voor maandelijkse gesprekken en afgeronde acties;
- stoplichtoverzicht voor actieve leden;
- nieuw gesprek starten;
- open acties bekijken;
- eigen leden bekijken;
- nieuw lid toevoegen;
- trainer-visible lidnotities vanuit management zien als meldingen;
- berichten naar management sturen;
- berichten van management beantwoorden of verwijderen.

### Studio-console

De tabletconsole gebruikt:

- `/console?token=...`;
- een geldig `console_tokens` record;
- trainer- of managementkeuze;
- 4-cijferige PIN-verificatie;
- een HMAC-gesigneerde `console_session` cookie.

Trainer-console-sessies worden beperkt tot de eigen trainerroute, gesprekken en liddossiers. Management-console-sessies krijgen managementscope, maar geen adminscope.

## Belangrijkste UI-routes

```text
/                              startpagina; proxy redirectt ingelogde rollen
/login                         normale Supabase-login
/admin                         adminpaneel
/management                    managementdashboard
/management/berichten          management-inbox voor trainerberichten
/console?token=...             tabletconsole-token validatie en PIN-login
/trainer/[trainerId]           trainerdashboard
/trainer/[trainerId]/acties    acties voor een trainer
/trainer/[trainerId]/leden     filterbare ledenlijst voor een trainer
/leden/[id]                    liddossier
/leden/[id]/vooruitgang        voortgangsoverzicht
/leden/[id]/evaluatie/[cyclus] evaluatiedetail
/gesprek/new                   nieuw evaluatiegesprek
/gesprek/new?lid_id=...        nieuw gesprek met lid vooringevuld
/nieuw-lid                     placeholder zonder werkende UI
```

Let op: in `src/proxy.ts` redirectt een trainer vanaf `/` nog naar `/leden`, maar er is geen `src/app/leden/page.tsx`. De daadwerkelijke trainerflow gebruikt `/trainer/[trainerId]`.

## App-structuur

```text
src/
  app/
    admin/                         adminpaneel
    api/                           API-routes voor data en mutaties
    components/                    Navigation en AdminBar
    console/                       tabletlogin via token + PIN
    gesprek/new/                   nieuw evaluatiegesprek
    leden/[id]/                    liddossier
    leden/[id]/evaluatie/[cyclus]/ evaluatiedetail
    leden/[id]/vooruitgang/        voortgangsoverzicht
    login/                         Supabase Auth-login
    management/                    managementdashboard
    management/berichten/          management-inbox
    nieuw-lid/                     placeholder
    trainer/[trainerId]/           trainerdashboard
    trainer/[trainerId]/acties/    acties per trainer
    trainer/[trainerId]/leden/     ledenlijst per trainer
  lib/
    actieUrgency.ts                actie-urgentie en open/toekomstig logica
    consoleSession.ts              HMAC console-session cookie
    serverAuth.ts                  server/API auth-context en access checks
    stoplight.ts                   stoplichtlogica
    supabase.ts                    browser Supabase client
    supabase-server.ts             server Supabase client met user session
    trainerData.ts                 gedeelde trainerdashboard-data
  proxy.ts                         route guards en auth headers
```

## Auth en Toegang

### Browser-login

Client-side login gebruikt Supabase Auth. Server/API-auth loopt via:

```ts
getServerAuthContext(req)
```

uit `src/lib/serverAuth.ts`.

Die helper ondersteunt twee auth-modi:

- `session`: normale Supabase sessie;
- `console`: gevalideerde HMAC `console_session`.

### Service-role gebruik

`src/lib/serverAuth.ts` bevat:

```ts
getServiceRoleClient()
```

Deze stateless service-role client wordt gebruikt nadat app-level auth al is gecontroleerd, voor mutaties of reads die anders door Supabase RLS of een gelekte request-JWT kunnen falen. Dit is onder andere relevant voor:

- management replies in `trainer_notities`;
- trainer-thread reads waar management-authored berichten zichtbaar moeten zijn;
- lidnotities die door management worden aangemaakt en zichtbaar voor trainers kunnen zijn.

Gebruik service-role nooit direct vanuit client-side code.

### Proxy

`src/proxy.ts`:

- laat `/login`, `/console`, `/api/console/*` en `/api/auth-context` publiek door;
- valideert console-sessies cryptografisch zonder databasecall;
- gebruikt Supabase session auth voor normale routes;
- gate adminroutes via `ADMIN_UUID`;
- gate managementroutes op rol `management` of admin UUID;
- beperkt trainer-console-sessies tot eigen trainerdashboard, `/gesprek` en `/leden/[id]`.

## API-routes

```text
/api/auth-context                         huidige rol/authMode/trainerId

/api/admin/list                           gebruikerslijst
/api/admin/create                         trainer of managementgebruiker maken
/api/admin/delete                         gebruiker deactiveren en auth-user verwijderen
/api/admin/pins                           PIN-overzicht
/api/admin/pin                            trainer-PIN instellen
/api/admin/pin-management                 management-PIN instellen
/api/admin/console-tokens                 admin console-tokenbeheer

/api/management/data                      managementdashboard-data
/api/management/trainers                  trainer aanmaken vanuit management
/api/management/trainers/[id]             trainer activeren/deactiveren
/api/management/leden/[id]                lid activeren/deactiveren/status/trainer wijzigen of verwijderen
/api/management/console-tokens            management console-tokenbeheer
/api/management/console-tokens/[id]       console-token wijzigen of intrekken/verwijderen

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
/api/trainer-notities/[trainer_id]        trainer/management thread ophalen of bericht plaatsen
/api/trainer-notities/[trainer_id]/[notitie_id] bericht soft-deleten

/api/console/validate                     console-token valideren en cookie zetten
/api/console/people                       trainers en management voor consolekeuze
/api/console/verify-pin                   PIN controleren en console_session zetten
/api/console/refresh                      console_session verversen
/api/console/logout                       console_session wissen
```

Er staat ook `src/app/admin/trainers/route.ts`; dit is geen route in de huidige `app/api` structuur en wordt niet als normale API-route in de route-output van `next build` vermeld.

## Leden

Leden worden opgeslagen in `leden`.

Leden kunnen worden toegevoegd via:

- trainerdashboard: `POST /api/trainer/[trainer_id]/leden`;
- managementdashboard: management UI en management APIs.

Leden kunnen actief, inactief of gestopt zijn. Management kan leden stoppen, heractiveren, verwijderen en aan een andere trainer koppelen.

Trainerleden worden gebruikt voor:

- stoplichtstatus;
- gesprekselectie;
- ledenlijst;
- acties;
- zichtbare managementnotities.

## Gesprekken en Evaluaties

Nieuwe gesprekken worden opgeslagen via `POST /api/gesprek`.

De server:

- controleert toegang tot het lid;
- bepaalt de volgende `cyclus`;
- schrijft een evaluatie met leefstijlscores, fysieke metingen, doel, tevredenheid en vrije notitievelden;
- schrijft optioneel contactmomenten/notities afhankelijk van de request-body.

Evaluaties zijn zichtbaar in het liddossier, de evaluatiedetailpagina en de voortgangspagina.

## Stoplichtlogica

Stoplichtstatus gebruikt de meest recente datum uit contactmomenten en evaluaties:

```text
Groen  contact binnen 14 dagen
Oranje 15 t/m 28 dagen
Rood   29 dagen of langer, of geen contact bekend
```

Implementatie: `src/lib/stoplight.ts`.

## Acties

Acties staan in `acties`.

Acties kunnen:

- aan een lid gekoppeld zijn;
- direct aan een trainer gekoppeld zijn zonder lid;
- van management of trainer afkomstig zijn;
- open, afgerond of overdue zijn.

Urgentie staat in `src/lib/actieUrgency.ts`:

```text
Geen deadline              rood
Deadline binnen 7 dagen    rood / Kritiek
Deadline binnen 14 dagen   oranje / Urgent
Deadline binnen 21 dagen   groen / Open
Traineractie > 21 dagen    toekomstig en niet zichtbaar als open dashboardactie
Managementactie > 21 dagen blijft groen/open
```

Afgeronde acties tellen mee in de momentumstrip van de huidige maand.

## Lidnotities

Lidnotities staan in `notities`.

Eigenschappen:

- gekoppeld aan een lid;
- optioneel gekoppeld aan een evaluatie;
- auteurtype `trainer`, `management` of `admin`;
- soft-delete via `verwijderd`;
- `toon_aan_trainer` bepaalt of een managementnotitie als trainer-melding verschijnt;
- `gezien` bepaalt of die melding nog open staat.

Management kan vanuit het managementdashboard een lidnotitie maken en aanvinken dat deze aan de trainer getoond moet worden. In de UI heet dit nog "Urgent voor trainer", maar technisch is het de zichtbaarheid/actieflag `toon_aan_trainer`.

Trainerdashboard toont zulke notities als meldingen zolang:

```text
toon_aan_trainer = true
gezien = false
verwijderd = false
```

De trainer kan een melding als gezien markeren via:

```text
PATCH /api/notities/[lid_id]/[notitie_id]
```

Trainer-facing meldingen krijgen automatisch een in-message lidreferentie:

```text
Betreft: Voornaam Achternaam (LID-ID)

[tekst van management]
```

## Trainerberichten

Trainerberichten staan in `trainer_notities` en vormen de berichtenstroom tussen trainer en management.

### Management-inbox

`/management/berichten` toont alleen trainer-authored berichten uit de aggregate route:

```text
GET /api/trainer-notities
```

Management kan op berichtniveau:

- `Beantwoorden`: plaatst een managementbericht in de trainerthread en verbergt het oorspronkelijke trainerbericht lokaal uit de huidige inboxweergave;
- `Verwijder`: soft-delete het bericht in de database via `verwijderd = true`.

Management replies worden bewust niet opnieuw in de management-inbox getoond.

### Trainerdashboard

Het trainerdashboard heeft twee gelijke panelen:

- links `Bericht sturen`: nieuw bericht naar management;
- rechts `Berichten van management`: alleen management/admin-authored berichten.

Op managementberichten kan de trainer:

- `Beantwoorden`: stuurt een bericht naar management en verbergt het oorspronkelijke managementbericht lokaal uit de huidige trainerweergave;
- `Verwijder`: soft-delete het managementbericht in de database.

Trainer-sent berichten worden niet in het rechter managementberichtenpaneel getoond.

### Delete en reply semantiek

- Delete betekent database soft-delete met `verwijderd = true`, waardoor het bericht voor beide kanten verdwijnt.
- Reply betekent: nieuw bericht aanmaken en het oorspronkelijke bericht uit de huidige view halen.
- De oude `gelezen_door_management` leesstatusfunctionaliteit is uit de actieve UI/API-flow verwijderd.

## Console

Consoleflow:

1. `/console?token=...` valideert het token via `/api/console/validate`.
2. De console haalt personen op via `/api/console/people`.
3. De gebruiker kiest trainer of management.
4. `/api/console/verify-pin` controleert de PIN via Supabase RPC.
5. De server zet `console_session`.
6. `/api/console/refresh` verlengt de sessie.
7. `/api/console/logout` wist de sessie.

Console-tokenstatus wordt bijgehouden in `console_tokens`.

## Supabase Tabellen

Tabellen die de huidige code gebruikt:

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

## Supabase RPC's

RPC's die de huidige code aanroept:

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

## Omgevingsvariabelen

Maak lokaal een `.env.local` met:

```text
NEXT_PUBLIC_SUPABASE_URL        Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   Supabase anon public key
SUPABASE_SERVICE_ROLE_KEY       Supabase service_role key voor server/API-routes
CONSOLE_SESSION_SECRET          Optioneel; HMAC-secret voor console_session cookies
```

Als `CONSOLE_SESSION_SECRET` ontbreekt, gebruikt `src/lib/consoleSession.ts` de service-role key als fallback.

`SUPABASE_SERVICE_ROLE_KEY` mag nooit naar client-side code, logs of browserbundles lekken.

## Lokaal Draaien

```bash
npm install
npm run dev
```

Open daarna:

```text
http://localhost:3000
```

Beschikbare scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Technische Stack

- Next.js `16.2.3`
- React `19.2.4`
- TypeScript `^5`
- Supabase Auth, database en RPC's
- `@supabase/ssr` `^0.10.2`
- `@supabase/supabase-js` `^2.103.0`
- `qrcode.react` `^4.2.0`
- Tailwind CSS `^4`
- ESLint `^9` met `eslint-config-next`

## Ontwikkelrichtlijnen

- Lees bij Next.js wijzigingen eerst `node_modules/next/dist/docs/`, zoals vastgelegd in `AGENTS.md`.
- Nieuwe gevoelige mutaties horen via API-routes te lopen.
- Controleer eerst app-level auth met `getServerAuthContext(req)`.
- Gebruik `getServiceRoleClient()` alleen server-side en alleen nadat toegang expliciet is gecontroleerd.
- Laat unrelated dirty files staan; `.claude/settings.local.json` is lokaal gewijzigd en hoort niet automatisch mee in commits.

## Bekende Aandachtspunten

- `/nieuw-lid` is een placeholder, ondanks dat de startpagina ernaar linkt.
- De root proxy redirect voor trainers wijst naar `/leden`, maar er is geen ledenindexpagina.
- Admin gating gebruikt een hardcoded UUID in `src/proxy.ts`.
- Enkele oude comments en UI-strings bevatten mojibake door encodingproblemen.
- Sommige pagina-comments zijn ouder dan de implementatie; deze README en de code zijn leidend.
