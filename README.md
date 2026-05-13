# WAV-e

## 1. Wat is WAV-e?

WAV-e is een coaching-intelligentielaag voor een EMS-studio. Het helpt trainers bij het bijhouden van coachingscycli, contactmomenten en acties per lid. Managers kunnen studio-breed zien hoe het coachingswerk verloopt.

## 2. Lokaal opstarten

1. Repository clonen
2. `npm install`
3. `.env.local` aanmaken (zie sectie hieronder)
4. `npm run dev`
5. Open `http://localhost:3000`

## 3. Benodigde omgevingsvariabelen

```text
NEXT_PUBLIC_SUPABASE_URL        — Supabase dashboard → Project Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   — Supabase dashboard → Project Settings → API → anon public key
SUPABASE_SERVICE_ROLE_KEY       — Supabase dashboard → Project Settings → API → service_role key (geheim, nooit publiek)
```

## 4. Mappenstructuur

```text
src/
  app/          — alle pagina's en API routes
    admin/        — beheerpagina voor gebruikers, PIN-codes en studio-consoles
    api/          — server-side API routes voor admin- en consolefuncties
    components/   — gedeelde navigatie- en beheerbalken binnen de app
    console/      — tablet-login via console-token en PIN
    gesprek/      — nieuw evaluatiegesprek invoeren
    leden/        — ledenprofiel, evaluatiegeschiedenis en vooruitgang
    login/        — inlogpagina voor admin, management en trainers
    management/   — studio-overzicht voor management
    nieuw-lid/    — lege placeholder; leden aanmaken loopt via management of trainerdashboard
    trainer/      — trainerdashboard en ledenlijst per trainer
  lib/          — gedeelde hulpfuncties voor stoplichtlogica en Supabase clients
```

## 5. Een nieuw lid toevoegen

Een nieuw lid kan op twee plekken worden toegevoegd.

Via management:

1. Log in als management.
2. Ga naar de managementpagina.
3. Klik rechtsboven op `+ Lid toevoegen`.
4. Vul de verplichte velden in: Lid-ID, voornaam, achternaam, startdatum en trainer.
5. Vul eventueel e-mail en telefoon in.
6. Klik op `Lid toevoegen`.

Via het trainerdashboard:

1. Log in als trainer, of kies de trainer via de tablet-console.
2. Klik bovenin op `+ Nieuw lid`.
3. Vul de verplichte velden in: Lid-ID, voornaam, achternaam en startdatum.
4. Vul eventueel e-mail en telefoon in.
5. Klik op `Lid toevoegen`.

Bij toevoegen via het trainerdashboard wordt het lid automatisch aan die trainer gekoppeld. Het lid wordt direct actief gezet.

## 6. Een nieuwe trainer toevoegen

Een nieuwe trainer kan op twee plekken worden toegevoegd.

Via management:

1. Log in als management.
2. Ga naar de managementpagina.
3. Klik bij het blok `Trainers` op `+ Trainer toevoegen`.
4. Vul de verplichte velden in: voornaam, achternaam, e-mail en wachtwoord.
5. Klik op `Trainer toevoegen`.

Via admin:

1. Log in als admin.
2. Ga naar de adminpagina.
3. Klik op `+ Nieuwe gebruiker`.
4. Vul voornaam, achternaam, e-mail en wachtwoord in.
5. Kies bij rol `Trainer`.
6. Klik op `Aanmaken`.

De trainer wordt direct actief aangemaakt met een eigen login. Een PIN voor de tablet-console stel je daarna apart in op de adminpagina bij `Console PINs`.

## 7. Hoe werkt het stoplicht?

Het stoplicht laat zien hoe lang geleden er contact is geweest met een lid. Groen betekent dat er binnen 14 dagen contact is geweest: het lid is op koers. Oranje betekent 15 tot 28 dagen: er is aandacht nodig. Rood betekent 29 dagen of meer, of dat er nog geen contact bekend is: dit is urgent.

Met contact bedoelt WAV-e het meest recente contactmoment of de meest recente evaluatie. De nieuwste van die twee telt.

## 8. Bekende aandachtspunten

- iPad Safari login via session cookie is nog niet op het echte apparaat getest. Bart moet als eerste stap inloggen op de echte iPad controleren.
- Momentum strip op het trainer welkomstscherm staat gepland voor v0.1.1 en is nog niet gebouwd.
- QR-code op token aanmaken staat gepland voor v0.1.1 en is nog niet gebouwd.
- v0.2 integraties met Onlineafspraken.nl, Google Calendar en WhatsApp Business API zijn gepland na stabilisatie van v0.1.
