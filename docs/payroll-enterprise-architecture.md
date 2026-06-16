# SmartHR Payroll Enterprise Architecture

## Objectif

Le module Paie evolue vers un moteur parametable multi-entreprises adapte a la RDC. Le socle implemente conserve les fiches existantes, ajoute des rubriques configurables, des taux legaux historises, un bareme IPR versionne et un snapshot complet de calcul.

## Architecture NestJS

```mermaid
flowchart LR
  UI[React Payroll UI] --> API[PayrollController]
  API --> Service[PayrollService]
  Service --> Engine[PayrollEngineService]
  Engine --> Employees[(employees/contracts)]
  Engine --> Currency[(currency_settings)]
  Engine --> Rubrics[(payroll_rubrics)]
  Engine --> Rates[(payroll_legal_rates)]
  Engine --> IPR[(payroll_ipr_brackets)]
  Service --> Payrolls[(payrolls)]
  Service --> Details[(payroll_details)]
  Service --> Audit[(audit_logs)]
```

## Modeles principaux

```mermaid
erDiagram
  companies ||--o{ employees : owns
  employees ||--o{ contracts : has
  employees ||--o{ payrolls : receives
  payrolls ||--o{ payroll_details : contains
  companies ||--o{ payroll_rubrics : configures
  companies ||--o{ payroll_legal_rates : configures
  companies ||--o{ payroll_ipr_brackets : configures
  companies ||--o{ payroll_periods : closes

  payrolls {
    int id
    int employee_id
    int month
    int year
    decimal base_salary
    decimal gross_salary
    decimal taxable_salary
    decimal total_deductions
    decimal employer_contributions
    decimal net_fiscal
    decimal net_salary
    varchar status
    jsonb calculation_snapshot
  }

  payroll_details {
    int id
    int payroll_id
    varchar code
    varchar label
    varchar category
    varchar type
    decimal base_amount
    decimal amount
    decimal employer_amount
    jsonb metadata
  }

  payroll_periods {
    int id
    int company_id
    int month
    int year
    varchar status
    int closed_by
    timestamp closed_at
    text reason
  }
```

## Workflow

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> preparation
  preparation --> review
  review --> validated
  validated --> closed
  closed --> paid
  draft --> archived
  archived --> draft
```

## API REST

- `GET /api/payroll` : liste des fiches, filtrable par mois, annee, entreprise.
- `GET /api/payroll/summary` : masse salariale, brut, deductions, charges employeur.
- `POST /api/payroll/generate` : generation individuelle compatible avec l'ecran actuel.
- `POST /api/payroll/generate-batch` : generation collective asynchrone par entreprise/periode.
- `GET /api/payroll/jobs/:id` : suivi de progression du traitement collectif.
- `POST /api/payroll/jobs/:id/cancel` : annulation d'un traitement en attente ou en cours.
- `POST /api/payroll/engine/preview` : simulation sans persistance.
- `GET /api/payroll/engine/configuration` : rubriques, taux legaux, baremes IPR.
- `POST /api/payroll/engine/rubrics` : creation ou mise a jour d'une rubrique sans developpement.
- `POST /api/payroll/engine/legal-rates` : ajout d'une nouvelle version de taux legal.
- `POST /api/payroll/engine/ipr-brackets` : ajout d'une nouvelle tranche/version IPR.
- `GET /api/payroll/period/status` : statut d'ouverture ou de cloture d'une periode.
- `POST /api/payroll/period/close` : cloture une periode pour figer les modifications.
- `POST /api/payroll/period/reopen` : rouvre une periode avec audit.
- `PUT /api/payroll/:id/workflow/:status` : transition controlee du workflow.
- `GET /api/payroll/:id/payslip` : bulletin HTML imprimable ou enregistrable en PDF depuis le navigateur.
- `GET /api/payroll/journal/export` : journal de paie CSV compatible Excel.
- `GET /api/payroll/journal/export-excel` : journal de paie Excel compatible `.xls`.
- `GET /api/payroll/book/export-excel` : livre de paie consolide par departement en `.xls`.
- `GET /api/payroll/audit-trail` : piste d'audit paie de la periode.

## Regles RDC actuellement seedees

- CNSS employe: 5%.
- CNSS employeur: 13%.
- INPP employeur: 1%.
- ONEM employeur: 0.2%.
- IPR: bareme progressif configurable, seed initial a 15%.

Ces valeurs sont parametrees dans `payroll_legal_rates` et `payroll_ipr_brackets`; une paie deja generee conserve son snapshot et ne change pas si les taux futurs changent.

## Administration des taux et baremes

Les administrateurs Paie peuvent ajouter:

- un taux legal versionne par entreprise ou globalement;
- une tranche IPR versionnee;
- une rubrique entreprise.

Chaque ajout conserve l'historique avec `effective_from`, `effective_to`, `version` et `created_by`. Le moteur choisit les lignes applicables a la periode de paie et les copie dans le snapshot de calcul.

## Snapshot de calcul

Chaque fiche stocke `calculation_snapshot` avec:

- version moteur;
- periode;
- employe et contrat utilises;
- devise et taux de change;
- rubriques actives;
- taux legaux applicables;
- bareme IPR applicable;
- totaux calcules.

Ce snapshot permet de reconstituer une paie plusieurs annees apres sa cloture.

## Generation collective

La generation collective cree une entree `payroll_generation_jobs` avec:

- statut: `queued`, `running`, `completed`, `completed_with_errors`, `cancelled`;
- nombre total d'employes;
- nombre traite;
- nombre de succes;
- nombre d'echecs;
- erreurs par employe en JSONB.

Le traitement continue meme si un employe echoue. Chaque fiche generee conserve son audit, et le job collectif est lui-meme audite sous l'entite `payroll_generation_jobs`.

## Cloture des periodes

La table `payroll_periods` permet de verrouiller une periode par entreprise, mois et annee. Une periode ouverte autorise les generations, modifications, variables RH, saisies temps et transitions de workflow. Une periode cloturee reste consultable et exportable, mais bloque toute action qui modifierait les montants ou le cycle de validation.

Operations controlees:

- consultation du statut avec `payroll:read`;
- cloture et reouverture avec `payroll:write`;
- audit de chaque cloture/reouverture dans `audit_logs`;
- blocage serveur dans `PayrollService` avant generation individuelle, generation collective, modification, variable RH et temps/presence;
- blocage UI sur les boutons de generation et d'ajustement.

Cette approche preserve les paies cloturees contre les recalculs involontaires tout en gardant une reouverture tracee pour les corrections autorisees.

## Audit operationnel Paie

L'ecran Paie affiche une carte `Tracabilite paie` pour la periode courante. Elle consolide les actions issues de `audit_logs`:

- generations individuelles et collectives;
- transitions de workflow;
- imports CSV variables et temps/presence;
- clotures et reouvertures de periode;
- changements de statut et archivages.

API:

- `GET /api/payroll/audit-trail?month=...&year=...&companyId=...`

Cette vue complete le journal d'audit global administrateur avec une lecture metier centree sur la periode de paie.

## Collecte des variables RH

Les elements variables sont stockes dans `payroll_variable_inputs`:

- primes, bonus, commissions et gratifications;
- indemnites ponctuelles;
- avances sur salaire;
- prets et retenues internes;
- retenues disciplinaires.

Chaque element est lie a un employe, une periode, une entreprise, un type (`allowance` ou `deduction`), une devise et un statut. Le moteur les collecte automatiquement lors d'une generation individuelle ou collective.

API:

- `GET /api/payroll/variables`
- `POST /api/payroll/variables`
- `POST /api/payroll/variables/import-csv`

L'ecran Paie expose un bouton `Ajouter variable`, un import CSV et une synthese des elements de la periode.

Format CSV variables:

```csv
matricule;code;label;type;category;amount;currency;taxable
EMP00031;PRIME;Prime rendement;allowance;variable_earning;150;USD;oui
EMP00032;AVANCE;Avance salaire;deduction;internal_deduction;25000;CDF;non
```

`employee_id` peut remplacer `matricule`. Les separateurs `;` et `,` sont acceptes.

## Temps et presence

Les saisies de temps sont stockees dans `payroll_time_inputs`:

- heures supplementaires;
- travail de nuit;
- travail dominical;
- jours feries travailles;
- absences non payees;
- retards.

API:

- `GET /api/payroll/time-inputs`
- `POST /api/payroll/time-inputs`
- `POST /api/payroll/time-inputs/import-csv`

Coefficients actuels du socle:

- heures supplementaires: 130% du taux horaire;
- nuit: 150%;
- dimanche: 200%;
- ferie travaille: 200%;
- absence non payee: taux journalier base sur 26 jours;
- retard: taux horaire prorate.

Ces lignes sont integrees automatiquement aux gains/retenues lors de la generation individuelle ou collective.

Format CSV temps/presence:

```csv
matricule;overtime_hours;night_hours;sunday_hours;holiday_hours;unpaid_absence_days;late_minutes;notes
EMP00031;8;2;0;0;0;15;Pointage mensuel
EMP00032;0;0;4;0;1;0;Absence sans solde
```

## Generation documentaire

Le socle documentaire fournit:

- bulletin individuel HTML imprimable, contenant employe, gains, retenues, charges employeur, net fiscal et net a payer;
- export du journal de paie en CSV `;` avec BOM UTF-8, ouvrable dans Excel;
- export Excel SpreadsheetML du journal detaille;
- export Excel SpreadsheetML du livre de paie avec consolidation par departement et onglet journal detaille;
- boutons UI pour ouvrir un bulletin et exporter CSV, journal Excel et livre de paie.

La generation PDF native pourra ensuite etre ajoutee avec une librairie serveur dediee, mais l'HTML actuel permet deja l'enregistrement PDF via le navigateur sans dependance supplementaire. Les exports Excel utilisent un format XML compatible Excel afin d'eviter une dependance serveur supplementaire.

## Tests

Le socle contient une suite de tests sans dependance externe:

```bash
cd Backend
npm run test:payroll
```

Couverture actuelle:

- calcul brut/net avec prime;
- CNSS employe;
- IPR;
- charges employeur CNSS/INPP/ONEM;
- conversion USD vers CDF;
- variables gains/retenues;
- primes non imposables;
- temps/presence;
- snapshot de calcul;
- bareme progressif.

Une suite d'integration API couvre les flux exposes par NestJS:

```bash
cd Backend
npm run test:payroll:api
```

Prerequis: backend local demarre sur `http://localhost:3000/api` ou variable `API_BASE_URL` definie. La suite se connecte avec l'administrateur de test, utilise une periode future, verifie imports CSV, generation, workflow, exports Excel et cloture de periode, puis nettoie ses donnees.

## Permissions

- `payroll:read` pour consulter et simuler.
- `payroll:write` reste supporte comme droit legacy global.
- `payroll:generate` pour generer une fiche ou lancer une generation collective.
- `payroll:update` pour modifier, archiver ou reactiver une fiche.
- `payroll:validate` pour faire avancer le workflow de validation.
- `payroll:close` pour cloturer ou rouvrir une periode.
- `payroll:export` pour telecharger bulletins, journaux et livres de paie.
- `payroll:configure` pour administrer rubriques, taux legaux et baremes IPR.
- `payroll:input` pour saisir variables RH et temps/presence.
- `payroll:import` pour importer variables et pointages depuis CSV.
- Les roles `admin` et `super_admin` restent autorises par le guard global.

## Prochains lots recommandes

1. Brancher une file BullMQ/Redis pour externaliser la generation collective.
2. Ajouter l'export Excel natif des bulletins, journaux et livre de paie.
3. Completer les tests d'integration API avec base de test isolee.
4. Ajouter les imports temps/presence depuis pointeuse ou fichiers Excel.
5. Ajouter les signatures electroniques et le stockage documentaire long terme.
