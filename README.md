# Le p'tit bout de bois

Boutique en ligne réalisée pour un artisan qui crée et vend des objets en bois
tournés et sculptés. Le besoin : présenter ses créations, encaisser les commandes
en ligne et administrer lui-même son catalogue.

<!-- CAPTURE D'ÉCRAN : ajouter ici une image du site (ex: ![Aperçu](docs/screenshot.png)) -->
<!-- SITE EN LIGNE : ajouter ici le lien vers le site en production -->

## Stack technique

- **Node.js** + **Express** (serveur et API REST)
- **Turso / libSQL** en production, **SQLite** en développement
- **HTML, CSS et JavaScript natifs** côté client, sans framework
- **Stripe** pour le paiement, **Resend** pour les emails transactionnels
- **Vercel Blob** + **Sharp** pour le stockage et l'optimisation des images
- **Helmet**, **express-rate-limit**, **bcrypt** et sessions par cookie pour la sécurité
- Déploiement **Vercel**

## Fonctionnalités

- Catalogue filtrable par catégorie et par essence de bois, avec fiches produit
  détaillées et galerie d'images.
- Panier et tunnel de commande avec paiement en ligne via Stripe et calcul
  automatique des frais de livraison.
- Back-office protégé par authentification : gestion des produits, des images,
  des commandes, des messages de contact et des paramètres de la boutique.
- Emails automatiques de confirmation de commande et de prise de contact.
- Thèmes visuels et mode maintenance activables côté serveur.

## Déploiement

Hébergement sur **Vercel** (fonction serverless Node.js configurée dans
`vercel.json`), déploiement continu depuis la branche `main`. La base de données
est hébergée sur **Turso** et les images sur **Vercel Blob**. Toutes les clés et
identifiants proviennent des variables d'environnement Vercel (voir `.env.example`).
