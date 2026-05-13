# WAV-e

WAV-e is een coaching-intelligentielaag voor een EMS-studio. De app helpt trainers, management en admin bij het volgen van leden, coachingcycli, contactmomenten, acties, notities en studio-consoletoegang.

## 1. Wat zit er in de app?

### Rollen en toegang

- **Admin**: beheert gebruikers, rollen, PIN-codes en studio-consoles.
- **Management**: ziet het studio-overzicht, beheert trainers en leden, wijst acties toe en plaatst notities.
- **Trainer**: werkt vanuit een eigen dashboard met leden, gesprekken, open acties, meldingen en berichten.
- **Studio-console**: iPad/tablet-login via console-token en 4-cijferige PIN, zonder normale Supabase-login per trainer.

### Belangrijkste functies

- Supabase Auth login met rolgebaseerde redirects.
- Middleware routebescherming voor admin, management, trainer en console-routes.
- Trainerdashboard met stoplichtoverzicht, momentumstrip, snelle start voor gesprekken, open acties, ledenlijst en nieuw lid toevoegen.
- Momentumstrip op trainerdashboard met gesprekken en afgeronde acties van de huidige maand.
- Managementdashboard met studio-aantallen, trainerstatistieken, ledenfilters, actie-toewijzing, notities en consolebeheer.
- Adminpaneel voor gebruikersbeheer, PIN-beheer en studio-consolebeheer.
- Console-tokenbeheer met QR-code en kopieerbare console-URL.
- Tabletvriendelijke console-login met keuze tussen trainer en management, personenlijst en grote PIN-keypad.
- Ledenprofiel met contactgegevens, evaluaties, contactmomenten, gezondheidsignalen, open acties en notities.
- Notities per lid, inclusief urgente notities die zichtbaar worden als melding op het trainerdashboard.
- Trainerberichten als tweerichtings-thread tussen trainer en management.
- Open acties per trainer, inclusief management-acties zonder lidkoppeling, deadlines en verlopen status.
- Filterbare ledenlijst per trainer op stoplichtstatus en zoekterm.
- Nieuwe evaluatiegesprekken met leefstijl-scores, fysieke metingen, doelen, tevredenheid en notities.
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

Let op: `SUPABASE_SERVICE_ROLE_KEY` is geheim en mag nooit naar client-side code of publieke logs lekken. Deze key wordt server-side gebruikt voor admin- en consolefuncties.

## 4. Mappenstructuur

```text
src/
  app/
    admin/                  - adminpaneel voor gebruikers, PINs en console-tokens
    admin/trainers/         - route voor trainerbeheer
    api/admin/              - server-side admin API routes
    api/console/            - console-token en PIN-validatie
    api/notities/           - lidnotities ophalen, aanmaken, verwijderen en markeren
    api/trainer-notities/   - berichten/notities voor trainers
    components/             - gedeelde navigatie- en beheercomponenten
    console/                - tablet-login via console-token en PIN
    gesprek/new/            - nieuw evaluatiegesprek vastleggen
    leden/[id]/             - liddossier
    leden/[id]/evaluatie/   - evaluatiedetail per cyclus
    leden/[id]/vooruitgang/ - voortgangsgrafieken en fysieke metingen
    login/                  - Supabase Auth login
    management/             - managementdashboard
    nieuw-lid/              - placeholder; leden aanmaken loopt via management of trainerdashboard
    trainer/[trainerId]/    - trainerdashboard
    trainer/[trainerId]/acties/ - open acties per trainer
    trainer/[trainerId]/leden/  - filterbare ledenlijst per trainer
  lib/
    stoplight.ts            - stoplichtlogica en contactdatumhelpers
    supabase.ts             - client-side Supabase client
    supabase-server.ts      - server-side Supabase client

middleware.ts               - routebescherming, role checks en console-token cookie
```

## 5. Belangrijke routes

```text
/login                         - normale login
/admin                         - adminpaneel
/management                    - managementdashboard
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

WAV-e heeft twee soorten notities:

- **Lidnotities**: gekoppeld aan een lid en zichtbaar in het liddossier.
- **Trainernotities/berichten**: gekoppeld aan een trainer en zichtbaar als thread tussen management en trainer.

Management kan bij een lidnotitie kiezen of deze urgent zichtbaar moet zijn voor de trainer. Zulke notities verschijnen als `Urgente meldingen` op het trainerdashboard en kunnen door de trainer als gezien worden gemarkeerd.

## 11. Evaluaties en voortgang

Een nieuw gesprek maakt automatisch de volgende evaluatiecyclus aan. De trainer vult onder andere in:

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

- Next.js `16.2.3`
- React `19.2.4`
- TypeScript
- Tailwind CSS/PostCSS
- Supabase Auth, database en RPC's
- `@supabase/ssr` voor middleware/server-side clients
- `qrcode.react` voor console-token QR-codes

## 14. Bekende aandachtspunten

- De app is sterk gekoppeld aan de bestaande Supabase-tabellen en RPC's, zoals `user_roles`, `trainers`, `management_gebruikers`, `leden`, `evaluaties`, `contact_momenten`, `acties`, `console_tokens`, `validate_console_token` en `get_next_lid_id`.
- Admin-toegang bevat een vaste superuser UUID in `middleware.ts` en `src/app/login/page.tsx`.
- iPad Safari-login via session cookie en console-cookie moet op het echte apparaat periodiek opnieuw getest worden.
- Integraties met Onlineafspraken.nl, Google Calendar en WhatsApp Business API zijn nog niet geimplementeerd.
