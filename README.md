<<<<<<< HEAD
# SmartHR — Application RH & Payroll

Application complète de gestion des ressources humaines et de paie multi-entreprise.

## Stack technique

- **Backend** : NestJS (Node.js) + TypeORM
- **Frontend** : React + Tailwind CSS + Vite
- **Desktop** : Electron
- **Base de données** : PostgreSQL

## Démarrage rapide

### 1. Base de données

```bash
# Créer la base de données PostgreSQL
createdb smarthr_db
psql smarthr_db < database/schema.sql
```

### 2. Backend

```bash
cd Backend
cp .env.example .env
# Éditer .env avec vos paramètres DB
npm install
npm run start:dev
# API disponible sur http://localhost:3000/api
# Swagger docs : http://localhost:3000/api/docs
```

### 3. Frontend

```bash
cd Frontend
npm install
npm run dev
# Interface sur http://localhost:5173
```

### 4. Desktop (optionnel)

```bash
cd Desktop
npm install
npm start
```

## Modules implémentés

| Module | Statut |
|--------|--------|
| Authentification JWT | ✅ |
| Gestion Entreprises | ✅ |
| Gestion Employés | ✅ |
| Contrats | ✅ |
| Paie (CNSS, IPR, INPP, ONEM) | ✅ |
| Congés | ✅ |
| Rapports & Dashboard | ✅ |
| Paramètres | ✅ |
| GPEC, Discipline, Résiliation | 🔜 Phase 3 |
| Mobile (Flutter/React Native) | 🔜 Phase 4 |

## Roadmap

- **Phase 1** ✅ Auth · Entreprises · Employés
- **Phase 2** ✅ Paie · Congés
- **Phase 3** 🔜 Rapports avancés · GPEC · Documents RH
- **Phase 4** 🔜 Automatisation · Mobile
=======
# SMARTHR
>>>>>>> 06e166c7af74f900e2d84065bf33ec31520b3fd0
