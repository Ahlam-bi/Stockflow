# StockFlow — Mini ERP de gestion de stock

Application de démonstration de gestion des produits, catégories, clients, commandes et mouvements de stock.

## Stack
- Frontend : React + Vite
- Backend : Node.js + Express, JWT, bcryptjs, Zod
- Base : PostgreSQL avec requêtes SQL paramétrées

## Prérequis
Node.js 20+ et Docker Desktop (ou PostgreSQL installé localement).

## Démarrage rapide (Windows PowerShell)
1. Démarrer PostgreSQL : `docker compose up -d postgres`
2. Dans `server`, copier `.env.example` en `.env`, puis modifier `JWT_SECRET` avec une valeur aléatoire privée.
3. Depuis `server` : `npm install`, `npm run db:init`, `npm run db:seed`, `npm run dev`.
4. Dans un second terminal, depuis `client` : `npm install`, `npm run dev`.
5. Ouvrir l'URL Vite affichée (par défaut `http://localhost:5173`).

Comptes de démonstration (mot de passe commun `Stockflow123!`):
- Admin : `admin@stockflow.local`
- Staff : `amine@stockflow.local` ou `sara@stockflow.local`

Le seed réinitialise les tables du schéma StockFlow. Ne le lancez pas sur une base contenant des données à conserver.

## Variables d'environnement serveur
`PORT`, `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` (voir `server/.env.example`). Le client peut définir `VITE_API_URL` (par défaut `http://localhost:4000/api`).

## API principale
- Auth : `POST /api/auth/login`, `GET /api/auth/me`
- Dashboard : `GET /api/dashboard`
- Catégories : `GET/POST /api/categories`, `PUT/DELETE /api/categories/:id` (écriture admin)
- Produits : `GET /api/products?search=&page=&limit=`, `GET/POST /api/products`, `PUT/DELETE /api/products/:id`
- Clients : `GET/POST /api/clients`, `PUT/DELETE /api/clients/:id`
- Commandes : `GET/POST /api/orders`, `POST /api/orders/:id/items`, `PATCH /api/orders/:id/status`
- Stock : `GET/POST /api/stock-movements?productId=`

Toutes les routes métier exigent `Authorization: Bearer <token>`. Le rôle staff peut gérer commandes et stock mais ne peut pas supprimer les produits. Les écritures catégories sont réservées à admin.

## Règles métier couvertes
- Les commandes commencent en brouillon. Les lignes ne sont modifiables qu'en brouillon.
- La confirmation vérifie le stock et déduit les quantités dans une transaction PostgreSQL avec verrouillage des produits.
- Les mouvements OUT contrôlent le stock sous verrou avant de mettre à jour le stock et le journal.
- Les quantités négatives sont également interdites par contrainte SQL.
- Le total de commande est calculé à partir des lignes et le prix unitaire est enregistré au moment de l'ajout.

## Modèle de données
`users 1—N orders`, `clients 1—N orders`, `categories 1—N products`, `orders 1—N order_items`, `products 1—N order_items`, `products 1—N stock_movements`, `users 1—N stock_movements`.

Le script `server/db/schema.sql` contient les clés étrangères, contraintes d'unicité, contraintes de quantité et index. Le seed crée 1 admin, 2 staff, 5 catégories, 15 produits, 5 clients, 10 commandes et mouvements IN/OUT.

## Notes de sécurité
Le secret JWT de `.env.example` est une valeur d'exemple à remplacer. Les mots de passe sont hachés avec bcrypt. Les requêtes SQL utilisent des paramètres. Helmet, limite de requêtes login et validation serveur sont activés. Pour une mise en production, utiliser HTTPS, un secret fort, des sauvegardes et une politique de rotation des comptes de démonstration.
