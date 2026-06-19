# Manuel de fonctionnement et de test global SmartHR

Ce document sert de guide pratique pour demarrer SmartHR, verifier que les services fonctionnent, puis tester tous les modules principaux de l'application.

## 1. Objectif du test global

Le test global doit confirmer que:

- l'utilisateur peut se connecter;
- la base PostgreSQL est accessible;
- le backend NestJS repond;
- le frontend React affiche correctement les ecrans;
- les donnees sont bien filtrees par entreprise;
- les modules RH, paie, temps/presence, conges, contrats, rapports, parametres, utilisateurs et audit fonctionnent ensemble;
- les exports et imports critiques fonctionnent;
- les workflows et permissions ne bloquent pas les actions attendues.

## 2. Prerequis

Installer ou verifier:

- Node.js compatible avec le projet;
- npm;
- PostgreSQL local ou conteneur Docker PostgreSQL;
- dependances installees dans `Backend` et `Frontend`;
- port backend libre: `3000`;
- port frontend libre: `5173`.

Identifiants admin seed:

```text
Email: admin@smarthr.com
Mot de passe: SmartHR@2026
```

Configuration locale attendue dans `Backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=smarthr2026
DB_NAME=smarthr_db
JWT_SECRET=smarthr_local_dev_secret
JWT_EXPIRES_IN=7d
PORT=3000
```

## 3. Preparation de la base de donnees

### 3.1 Base applicative

Si la base `smarthr_db` n'existe pas encore, la creer puis appliquer le schema:

```bash
createdb smarthr_db
psql smarthr_db < database/schema.sql
psql smarthr_db < database/upgrade_payroll_engine.sql
psql smarthr_db < database/upgrade_time_attendance.sql
```

Si PostgreSQL tourne via Docker, verifier que le conteneur expose `localhost:5432`.

### 3.2 Base de test paie API

Depuis `Backend`:

```bash
npm run db:test:payroll
```

Ce script cree ou met a jour `smarthr_test` et applique:

- `database/schema.sql`;
- `database/upgrade_platform_settings.sql`;
- `database/upgrade_payroll_engine.sql`;
- `database/upgrade_time_attendance.sql`.

## 4. Demarrage de l'application

### 4.1 Backend normal

Dans un terminal:

```bash
cd Backend
npm run start:dev
```

Verifier:

- API: `http://localhost:3000/api`;
- Swagger: `http://localhost:3000/api/docs`.

### 4.2 Frontend

Dans un second terminal:

```bash
cd Frontend
npm run dev
```

Ouvrir:

```text
http://localhost:5173
```

### 4.3 Backend pour test d'integration paie

Pour executer le test API paie avec la base `smarthr_test`, utiliser:

```bash
cd Backend
npm run start:test:payroll-api
```

Puis dans un autre terminal:

```bash
cd Backend
npm run test:payroll:api
```

## 5. Tests automatises a executer

Depuis `Backend`:

```bash
npm run build
npm run test:payroll
npm run test:time-attendance
npm run db:test:payroll
npm run test:payroll:api
```

Depuis `Frontend`:

```bash
npm run build
```

Resultat attendu:

- `Payroll engine tests passed`;
- `Time attendance engine tests passed`;
- `Payroll API integration tests passed`;
- build backend sans erreur TypeScript;
- build frontend Vite termine avec succes.

Note: sur Windows, le build frontend peut necessiter l'autorisation d'executer `esbuild`.

## 6. Parcours de test global manuel

### 6.1 Connexion et accueil

1. Ouvrir `http://localhost:5173`.
2. Se connecter avec `admin@smarthr.com / SmartHR@2026`.
3. Verifier l'arrivee sur la page d'accueil.
4. Verifier les raccourcis:
   - gestion des entreprises;
   - parametres;
   - administration utilisateurs.

Resultat attendu:

- connexion reussie;
- menu global visible;
- aucune redirection inattendue vers `/login`.

### 6.2 Entreprises

1. Aller dans `Entreprises`.
2. Creer une entreprise de test, par exemple `TEST GLOBAL SARL`.
3. Renseigner RCCM, telephone, email et adresse.
4. Ouvrir l'espace entreprise.
5. Revenir a la liste des entreprises.
6. Tester archive/reactivation si disponible.

Resultat attendu:

- l'entreprise apparait dans la liste;
- l'espace entreprise s'ouvre sur `/app/:companyId/dashboard`;
- les donnees de l'entreprise sont conservees.

### 6.3 Espace entreprise - tableau de bord

1. Entrer dans l'entreprise de test.
2. Ouvrir `Tableau de bord`.
3. Verifier les cartes statistiques:
   - employes;
   - contrats;
   - paie;
   - conges;
   - conformite RDC.

Resultat attendu:

- aucune erreur de chargement;
- les compteurs correspondent aux donnees creees dans l'entreprise.

### 6.4 Employes

1. Aller dans `Employes`.
2. Creer un employe actif.
3. Renseigner au minimum:
   - matricule;
   - nom;
   - prenom;
   - email;
   - departement;
   - poste;
   - salaire de base;
   - statut actif.
4. Ouvrir la fiche detail.
5. Modifier une information.
6. Tester la recherche par nom ou matricule.

Resultat attendu:

- l'employe est cree et visible;
- la fiche detail affiche informations, contrats, paie, conges et documents;
- la recherche retrouve l'employe.

### 6.5 Documents employe

1. Ouvrir la fiche detail d'un employe.
2. Aller dans la zone documents.
3. Ajouter un document de type contrat, CV ou autre.
4. Telecharger le document.
5. Remplacer ou supprimer le document si l'action est disponible.

Resultat attendu:

- upload accepte;
- document liste;
- telechargement fonctionne;
- actions auditees cote backend.

### 6.6 Contrats

1. Aller dans `Contrats`.
2. Creer un contrat pour l'employe de test.
3. Renseigner type, dates, salaire et statut.
4. Modifier le contrat.
5. Tester archive/reactivation si disponible.

Resultat attendu:

- contrat visible dans la liste;
- lien employe correct;
- statut affiche correctement.

### 6.7 Conges

1. Aller dans `Conges`.
2. Creer une demande de conge pour l'employe.
3. Tester les statuts:
   - en attente;
   - approuve;
   - refuse.
4. Verifier la fiche employe et le rapport conges.

Resultat attendu:

- demande creee;
- changement de statut applique;
- solde ou historique visible dans la fiche employe.

### 6.8 Paie entreprise

1. Aller dans `Paie`.
2. Choisir le mois et l'annee.
3. Generer une fiche pour l'employe de test.
4. Verifier les montants:
   - salaire de base;
   - brut;
   - retenues;
   - net;
   - CNSS/IPR/INPP/ONEM si applicable.
5. Faire avancer le workflow:
   - brouillon;
   - preparation;
   - verification;
   - valide;
   - cloture;
   - paye.
6. Ouvrir le bulletin HTML.
7. Exporter:
   - bulletin Excel `.xlsx`;
   - journal Excel;
   - livre de paie.
8. Archiver et signer le bulletin.

Resultat attendu:

- generation reussie;
- exports telechargeables;
- workflow applique;
- bulletin archive visible dans les documents paie.

### 6.9 Variables et temps de paie

1. Dans `Paie`, ajouter une variable:
   - prime;
   - retenue;
   - montant;
   - taxable oui/non.
2. Ajouter une saisie temps/presence:
   - heures supplementaires;
   - heures de nuit;
   - dimanche;
   - ferie;
   - absence non payee;
   - retard.
3. Importer un CSV variables.
4. Importer un CSV temps.
5. Importer un fichier Excel de pointage si disponible.
6. Regenerer la paie et verifier l'impact sur les montants.

Resultat attendu:

- imports acceptes;
- erreurs de lignes invalides signalees;
- montants de paie impactes correctement.

### 6.10 Cloture de periode paie

1. Cloturer la periode de paie.
2. Essayer de regenerer une paie sur la periode cloturee.
3. Essayer d'ajouter une variable ou un temps.
4. Rouvrir la periode avec un motif.

Resultat attendu:

- periode cloturee bloque les modifications;
- message d'erreur clair;
- reouverture possible avec audit.

### 6.11 Temps et presence

1. Aller dans `Temps`.
2. Creer un profil horaire standard:
   - code;
   - nom;
   - heures debut/fin;
   - pause;
   - tolerance retard.
3. Creer un pointage manuel pour l'employe:
   - entree;
   - sortie.
4. Importer un lot terminal.
5. Lancer le calcul de journee.
6. Verifier:
   - temps attendu;
   - temps travaille;
   - retard;
   - heures supplementaires;
   - heures de nuit;
   - statut presence.

Resultat attendu:

- pointages enregistres;
- calcul correct;
- journee visible dans la liste;
- audit cree.

### 6.12 Planning et rotations

1. Creer une rotation:
   - travail/repos;
   - jour/nuit si besoin;
   - date de debut de cycle.
2. Generer le planning sur plusieurs jours.
3. Filtrer par employe ou equipe.
4. Modifier une ligne de planning:
   - date;
   - profil;
   - statut;
   - heures planifiees.
5. Recalculer la journee si disponible.

Resultat attendu:

- planning genere;
- jours de repos et jours travailles coherents;
- modification conservee;
- recalcul applique.

### 6.13 Alertes et notifications temps

1. Lancer la detection des alertes.
2. Verifier les alertes:
   - retard;
   - absence;
   - pointage manquant;
   - depart anticipe.
3. Modifier le statut d'une alerte:
   - accuse;
   - resolu;
   - rejete.
4. Consulter l'outbox notifications.
5. Lancer le dispatch.
6. Retenter une notification echouee.

Resultat attendu:

- alertes creees ou mises a jour;
- notifications internes/email/SMS/WhatsApp simulees selon configuration;
- statuts visibles dans l'outbox.

### 6.14 Jobs temps async

1. Lancer un calcul async.
2. Consulter la liste des jobs.
3. Ouvrir le detail du job.
4. Annuler un job en attente ou en cours.
5. Verifier qu'un job annule ne repasse pas en `completed`.

Resultat attendu:

- job `queued`, puis `running`, puis `completed` ou `completed_with_errors`;
- job annule reste `cancelled`;
- erreurs auditees si le job echoue.

### 6.15 Export temps vers paie

1. Valider des journees temps en `hr_approved` ou `closed`.
2. Lancer `Exporter vers paie`.
3. Retourner dans `Paie`.
4. Verifier les saisies temps auto `TA_AUTO`.
5. Generer ou regenerer la fiche de paie.

Resultat attendu:

- donnees temps agregees dans `payroll_time_inputs`;
- doublons evites;
- paie impactee par overtime, nuit, dimanche, ferie, absence et retard.

### 6.16 Rapports

1. Aller dans `Rapports`.
2. Verifier les statistiques RH et paie.
3. Changer mois/annee si disponible.
4. Comparer avec les fiches de paie generees.

Resultat attendu:

- total net, brut et deductions coherents;
- graphiques visibles;
- liste detaillee correcte.

### 6.17 Parametres entreprise

1. Aller dans `Parametres`.
2. Ajouter:
   - departement;
   - poste;
   - type de document;
   - categorie;
   - workflow;
   - notification;
   - numerotation.
3. Modifier une entree.
4. Supprimer une entree non critique.

Resultat attendu:

- parametres listes;
- valeurs utilisables dans les formulaires metier;
- modifications conservees.

### 6.18 Utilisateurs, roles et permissions

1. Depuis l'espace global, aller dans `Utilisateurs`.
2. Creer un utilisateur de test.
3. Assigner un role.
4. Modifier le role ou les permissions.
5. Desactiver puis reactiver l'utilisateur.
6. Tester la connexion de cet utilisateur si besoin.

Resultat attendu:

- utilisateur cree;
- roles visibles;
- permissions appliquees;
- audit de modification present.

### 6.19 Audit

1. Aller dans l'administration utilisateurs ou audit si expose.
2. Verifier que les actions recentes existent:
   - creation employe;
   - generation paie;
   - workflow paie;
   - cloture periode;
   - pointage;
   - calcul temps;
   - export temps vers paie;
   - modification roles.

Resultat attendu:

- logs horodates;
- utilisateur, action, entite et details lisibles;
- suppression d'un log reservee aux droits audit.

## 7. Tests d'erreur a effectuer

Tester volontairement:

- connexion avec mauvais mot de passe;
- creation employe sans champ obligatoire;
- generation paie sans employe;
- generation sur periode cloturee;
- import CSV avec matricule inexistant;
- pointage avec type invalide;
- export temps vers periode paie cloturee;
- acces a une entreprise sans `companyId`.

Resultat attendu:

- erreur HTTP 400, 401, 403 ou 404 selon le cas;
- message utilisateur clair;
- aucune donnee partielle incoherente.

## 8. Donnees de test recommandees

Entreprise:

```text
Nom: TEST GLOBAL SARL
RCCM: TEST/RCCM/001
Email: test-global@example.test
Telephone: +243000000001
Adresse: Kinshasa
```

Employe:

```text
Matricule: TST001
Nom: Global
Prenom: Test
Email: test.global@example.test
Departement: Operations
Poste: Agent RH
Salaire de base: 1000
Statut: actif
```

Profil temps:

```text
Code: ADMIN
Nom: Horaire administratif
Debut: 08:00
Fin: 17:00
Pause: 12:00-13:00
Tolerance retard: 5 minutes
```

Profil nuit:

```text
Code: NIGHT
Nom: Equipe nuit
Debut: 18:00
Fin: 06:00
Tolerance retard: 5 minutes
```

CSV variable paie:

```csv
matricule;code;label;type;category;amount;currency;taxable
TST001;PRIME_TEST;Prime test;allowance;variable_earning;50;CDF;oui
```

CSV temps paie:

```csv
matricule;overtime_hours;night_hours;sunday_hours;holiday_hours;unpaid_absence_days;late_minutes;notes
TST001;2;1;0;0;0;15;Test global
```

Import terminal temps:

```text
TST001,entry,2026-06-18T08:05
TST001,exit,2026-06-18T17:30
```

## 9. Criteres d'acceptation finale

Le test global est accepte si:

- tous les builds passent;
- tous les tests automatises passent;
- connexion admin OK;
- creation entreprise OK;
- creation employe OK;
- contrat, conge, paie et temps/presence fonctionnent dans la meme entreprise;
- exports Excel paie telechargeables;
- periode paie cloturee bloque les modifications;
- temps/presence exporte correctement vers paie;
- rapports affichent les donnees attendues;
- audit contient les actions critiques;
- aucune erreur console bloquante pendant les parcours principaux.

## 10. Commandes de verification rapide

Backend:

```bash
cd Backend
npm run build
npm run test:payroll
npm run test:time-attendance
npm run db:test:payroll
npm run test:payroll:api
```

Frontend:

```bash
cd Frontend
npm run build
```

Demarrage manuel:

```bash
cd Backend
npm run start:dev
```

```bash
cd Frontend
npm run dev
```

## 11. Resultats de la derniere verification automatisee

Derniere verification effectuee:

- `Backend npm run db:test:payroll`: OK;
- `Backend npm run test:payroll`: OK;
- `Backend npm run test:time-attendance`: OK;
- `Backend npm run test:payroll:api`: OK;
- `Backend npm run build`: OK;
- `Frontend npm run build`: OK apres autorisation Windows pour `esbuild`.

Point d'attention:

- le build frontend peut afficher un avertissement Vite sur la taille du bundle; ce n'est pas bloquant pour le test fonctionnel.
