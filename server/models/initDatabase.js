const { createClient } = require('@libsql/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Configuration - utilise Turso si disponible, sinon SQLite local
let client;

if (process.env.TURSO_DATABASE_URL) {
  client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  console.log('🌐 Initialisation de la base Turso...');
} else {
  const path = require('path');
  const dbPath = path.join(__dirname, '../../database.db');
  client = createClient({
    url: `file:${dbPath}`,
  });
  console.log('💾 Initialisation de la base SQLite locale...');
}

async function initDatabase() {
  try {
    // Création des tables
    await client.batch([
      // Table des produits
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        wood_type TEXT,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        stock INTEGER DEFAULT 0,
        image_url TEXT,
        perlouze_link TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Table des commandes
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        customer_address TEXT,
        subtotal REAL,
        shipping_cost REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_method TEXT,
        payment_id TEXT,
        items TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Table des administrateurs
      `CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Table des paramètres du site
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Table des messages de contact
      `CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'nouveau',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ]);

    console.log('✨ Tables créées avec succès');

    // Migration : ajouter colonne description à wood_types
    try {
      await client.execute('ALTER TABLE wood_types ADD COLUMN description TEXT');
      console.log('🪵 Colonne description ajoutée à wood_types');
    } catch (e) {
      // La colonne existe déjà
    }

    // Créer l'administrateur par défaut
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || '***MOT_DE_PASSE_RETIRE***';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Vérifier si l'admin existe déjà
    const existingAdmin = await client.execute({
      sql: 'SELECT id FROM admins WHERE username = ?',
      args: [adminUsername]
    });

    if (existingAdmin.rows.length === 0) {
      // Renommer l'ancien admin "admin" si il existe
      const oldAdmin = await client.execute("SELECT id FROM admins WHERE username = 'admin'");
      if (oldAdmin.rows.length > 0) {
        await client.execute({
          sql: 'UPDATE admins SET username = ? WHERE username = ?',
          args: [adminUsername, 'admin']
        });
        console.log(`👤 Administrateur renommé en ${adminUsername}`);
      } else {
        await client.execute({
          sql: 'INSERT INTO admins (username, password, email) VALUES (?, ?, ?)',
          args: [adminUsername, hashedPassword, 'admin@lepetitboutdebois.fr']
        });
        console.log('👤 Administrateur créé');
      }
    } else {
      console.log('👤 Administrateur existant');
    }

    // Insérer les paramètres par défaut
    const defaultSettings = [
      ['site_name', 'le p'tit bout de bois'],
      ['site_description', 'Créations artisanales en bois par Jean-Michel Nougué-Lecocq'],
      ['contact_email', 'contact@lepetitboutdebois.fr'],
      ['perlouze_url', 'https://laptiteperlouze.fr']
    ];

    for (const [key, value] of defaultSettings) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
        args: [key, value]
      });
    }

    // Vérifier s'il y a déjà des produits
    const existingProducts = await client.execute('SELECT COUNT(*) as count FROM products');

    if (existingProducts.rows[0].count === 0) {
      // Insérer des produits d'exemple
      const sampleProducts = [
        ['Jeu de petits chevaux en chêne', 'Magnifique jeu de petits chevaux entièrement fait main en chêne massif. Plateau gravé et verni, pions tournés à la main.', 'Chêne massif', 65.00, 'Jeux', 3, '/images/products/petits-chevaux.jpg', null],
        ['Porte-bracelet tournant', 'Présentoir rotatif pour bracelets, idéal pour mettre en valeur vos bijoux. Fini huilé naturel.', 'Noyer', 28.00, 'Accessoires', 8, '/images/products/porte-bracelet.jpg', 'https://laptiteperlouze.fr/catalogue?category=bracelets'],
        ['Bracelet bois et pierres naturelles', 'Bracelet mixte associant perles de bois de rose et améthyste. Élastique résistant.', 'Bois de rose', 22.00, 'Bijoux bois & pierres', 5, '/images/products/bracelet-mixte.jpg', null],
        ['Set de 4 dessous de verre', 'Ensemble de 4 dessous de verre en bois recyclé, finition naturelle cirée.', 'Bois recyclé', 18.00, 'Accessoires', 12, '/images/products/dessous-verre.jpg', null],
        ['Porte-lunettes mural', 'Support mural pratique pour ranger vos lunettes. Fixation discrète incluse.', 'Pin', 15.00, 'Accessoires', 6, '/images/products/porte-lunettes.jpg', null],
        ['Jeu de dominos personnalisable', 'Jeu de 28 dominos en érable, avec possibilité de gravure personnalisée.', 'Érable', 45.00, 'Jeux', 4, '/images/products/dominos.jpg', null]
      ];

      for (const product of sampleProducts) {
        await client.execute({
          sql: 'INSERT INTO products (name, description, wood_type, price, category, stock, image_url, perlouze_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          args: product
        });
      }
      console.log('🪵 Produits d\'exemple ajoutés');
    } else {
      console.log('🪵 Produits existants conservés');
    }

    console.log('\n🌳 ════════════════════════════════════════ 🌳');
    console.log('   Base de données initialisée avec succès !');
    console.log('🌳 ════════════════════════════════════════ 🌳');
    console.log(`\n👤 Login admin: ${adminUsername}`);
    console.log(`🔑 Mot de passe: ${adminPassword}`);
    console.log('\n⚠️  N\'oubliez pas de changer le mot de passe admin !');

  } catch (err) {
    console.error('❌ Erreur lors de l\'initialisation:', err);
    throw err;
  }
}

// Exécuter l'initialisation
initDatabase()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
