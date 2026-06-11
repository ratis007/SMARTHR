# SmartHR - Application RH & Payroll

Application complete de gestion des ressources humaines et de paie multi-entreprise.

## Stack technique

- **Backend** : NestJS (Node.js) + TypeORM
- **Frontend** : React + Tailwind CSS + Vite
- **Desktop** : Electron
- **Base de donnees** : PostgreSQL

## Demarrage rapide

### 1. Base de donnees

```bash
createdb smarthr_db
psql smarthr_db < database/schema.sql
```

### 2. Backend

```bash
cd Backend
cp .env.example .env
# Modifier .env avec vos parametres PostgreSQL
npm install
npm run start:dev
```

API : http://localhost:3000/api
Swagger : http://localhost:3000/api/docs

### 3. Frontend

```bash
cd Frontend
npm install
npm run dev
```

Interface : http://localhost:5173

### 4. Desktop (optionnel)

```bash
cd Desktop
npm install
npm start
```

## Modules implementes

| Module | Statut |
|--------|--------|
| Authentification JWT | OK |
| Gestion entreprises | OK |
| Gestion employes | OK |
| Contrats | OK |
| Paie (CNSS, IPR, INPP, ONEM) | OK |
| Conges | OK |
| Rapports et dashboard | OK |
| Parametres | OK |
| GPEC, discipline, resiliation | Phase 3 |
| Mobile | Phase 4 |
