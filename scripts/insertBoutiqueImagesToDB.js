/**
 * Script pour insérer les images boutique uploadées dans la base Turso
 * 
 * Usage: node scripts/insertBoutiqueImagesToDB.js
 */

const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration Turso
const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Fichier de mapping
const MAPPING_FILE = path.join(__dirname, '../public/images/boutique-mapping.json');

async function main() {
    console.log('🚀 Insertion des images boutique dans la base Turso...\n');

    // Vérifier les variables d'environnement
    if (!process.env.TURSO_DATABASE_URL) {
        console.error('❌ TURSO_DATABASE_URL non défini');
        process.exit(1);
    }

    // Lire le fichier de mapping
    if (!fs.existsSync(MAPPING_FILE)) {
        console.error('❌ Fichier de mapping non trouvé:', MAPPING_FILE);
        console.error('   Exécutez d\'abord: node scripts/uploadBoutiqueImages.js');
        process.exit(1);
    }

    const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
    const images = Object.entries(mapping);

    console.log(`📦 ${images.length} images à insérer\n`);

    // S'assurer que la table existe
    console.log('🔧 Vérification de la table boutique_images...');
    await client.execute(`
        CREATE TABLE IF NOT EXISTS boutique_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path TEXT NOT NULL,
            display_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Table boutique_images prête\n');

    // Nettoyer les anciennes images (optionnel, décommentez si besoin)
    console.log('🧹 Nettoyage des anciennes images...');
    await client.execute('DELETE FROM boutique_images');
    console.log('✅ Anciennes images supprimées\n');

    // Insérer les nouvelles images
    console.log('📤 Insertion des images...');
    for (let i = 0; i < images.length; i++) {
        const [originalName, blobUrl] = images[i];

        await client.execute({
            sql: 'INSERT INTO boutique_images (image_path, display_order) VALUES (?, ?)',
            args: [blobUrl, i + 1]
        });

        console.log(`  ✅ ${originalName} → ordre ${i + 1}`);
    }

    console.log('\n🎉 Insertion terminée !');

    // Vérification
    const result = await client.execute('SELECT COUNT(*) as count FROM boutique_images');
    console.log(`📊 ${result.rows[0].count} images dans la table boutique_images`);

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
});
