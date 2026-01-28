# 🪵 Le P'tit Bout de Bois

**Boutique en ligne de créations artisanales en bois** par Jean-Michel Nougué-Lecocq

## 📋 Description

Site e-commerce complet pour la vente de créations artisanales en bois : jeux, accessoires, bijoux bois & pierres, et objets décoratifs.

## 🛠️ Technologies utilisées

### Backend
- **Node.js** + **Express.js** - Serveur web et API REST
- **Turso (libSQL)** - Base de données SQLite distribuée pour la production
- **SQLite3** - Base de données locale pour le développement
- **Stripe** - Paiement en ligne sécurisé
- **Resend / Nodemailer** - Envoi d'emails transactionnels
- **Multer + Sharp** - Upload et optimisation des images
- **Vercel Blob** - Stockage d'images en cloud
- **Helmet** - Sécurité HTTP headers
- **Express Rate Limit** - Protection contre les attaques DDoS
- **bcrypt** - Hashage des mots de passe

### Frontend
- **HTML5** - Structure des pages
- **CSS3 Vanilla** - Styles personnalisés avec variables CSS
- **JavaScript Vanilla** - Logique côté client, sans framework

### Hébergement
- **Vercel** - Déploiement et hébergement

## 🚀 Installation

```bash
# Cloner le repo
git clone https://github.com/gabnougue/le-ptit-bout-de-bois.git
cd le-ptit-bout-de-bois

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés API

# Initialiser la base de données
npm run init-db

# Lancer en développement
npm run dev
```

## 📁 Structure du projet

```
le-ptit-bout-de-bois/
├── public/              # Fichiers statiques
│   ├── admin/           # Interface d'administration
│   ├── css/             # Styles CSS
│   ├── js/              # Scripts JavaScript
│   └── images/          # Images du site
├── server/              # Code backend
│   ├── routes/          # Routes API Express
│   └── models/          # Modèles et migrations DB
├── server.js            # Point d'entrée
└── package.json
```

## ✨ Fonctionnalités

- 🛒 Catalogue produits par catégories (Jeux, Accessoires, Bijoux, Déco)
- 🌲 Filtrage par type de bois
- �️ Panier d'achat persistant
- � Paiement sécurisé via Stripe
- 📧 Système de messagerie client/admin
- 📱 Design responsive mobile-first
- � Panel d'administration complet

## 🔗 Lien avec La P'tite Perlouze

Ce site est lié à [La P'tite Perlouze](https://github.com/gabnougue/la-ptite-perlouze), la boutique de bijoux fantaisie d'Yvonne Lecocq. Certains produits bijoux bois & pierres peuvent avoir des liens croisés entre les deux boutiques.

---

*Fait avec ❤️ en France*
