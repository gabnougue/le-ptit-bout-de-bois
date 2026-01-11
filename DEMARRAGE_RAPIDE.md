# 🚀 Démarrage rapide - Le ptit bout de bois

## Installation en 3 étapes

### 1️⃣ Installer les dépendances
```bash
npm install
```

### 2️⃣ Initialiser la base de données
```bash
npm run init-db
```

Cela va créer :
- La base de données SQLite
- Les tables nécessaires
- Un compte admin (username: `admin`, password: `***MOT_DE_PASSE_RETIRE***`)
- 6 produits d'exemple

### 3️⃣ Démarrer le serveur
```bash
npm run dev
```

Le site est accessible sur **http://localhost:3001**

---

## 🎯 Accès rapide

### Site public
- 🏠 **Accueil** : http://localhost:3001
- 📦 **Catalogue** : http://localhost:3001/catalogue
- 🛒 **Panier** : http://localhost:3001/panier
- 📧 **Contact** : http://localhost:3001/contact

### Administration
- 🔐 **Login** : http://localhost:3001/admin
  - Username : `admin`
  - Password : `***MOT_DE_PASSE_RETIRE***`
- 📊 **Dashboard** : http://localhost:3001/admin/dashboard

---

## 🔗 Lien avec La p'tite perlouze

Si La p'tite perlouze tourne sur le port 3000 :
- Le portail en haut à droite permet de basculer entre les deux sites
- Certains produits ont des liens croisés vers les bijoux en pierres

---

## ⚠️ À faire après l'installation

1. **Changer le mot de passe admin** via le dashboard
2. **Configurer les emails** dans `.env` (optionnel)
3. **Ajouter vos propres produits** via l'admin
4. **Personnaliser les paramètres** selon vos besoins

---

## 🆘 Problème ?

### Le serveur ne démarre pas
```bash
# Vérifier que le port 3001 est libre
lsof -i :3001

# Changer le port dans .env si nécessaire
PORT=3002
```

### Réinitialiser la base de données
```bash
rm database.db
npm run init-db
```

---

**Bon développement ! 🪵**
