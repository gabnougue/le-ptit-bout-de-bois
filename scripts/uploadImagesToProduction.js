/**
 * Script d'upload des images locales vers Vercel Blob
 * puis association avec les produits dans Turso
 * 
 * Usage: node scripts/uploadImagesToProduction.js
 */

const { createClient } = require('@libsql/client');
const { put } = require('@vercel/blob');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration Turso
const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Dossier des images locales
const IMAGES_DIR = path.join(__dirname, '../public/images/products');

// Fonction pour compresser et uploader une image vers Vercel Blob
async function uploadImageToBlob(filePath, originalName) {
    console.log(`  📤 Upload: ${originalName}...`);

    const fileBuffer = fs.readFileSync(filePath);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.webp';

    // Compresser l'image avec sharp
    const compressedBuffer = await sharp(fileBuffer)
        .resize(800, 800, {
            fit: 'inside',
            withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toBuffer();

    // Upload vers Vercel Blob
    const blob = await put(`uploads/${uniqueName}`, compressedBuffer, {
        access: 'public',
        contentType: 'image/webp'
    });

    console.log(`  ✅ Uploadé: ${blob.url}`);
    return blob.url;
}

// Fonction pour associer une image à un produit
async function associateImageToProduct(productId, imageUrl, displayOrder, isPrimary) {
    await client.execute({
        sql: `INSERT INTO product_images (product_id, image_path, display_order, is_primary)
          VALUES (?, ?, ?, ?)`,
        args: [productId, imageUrl, displayOrder, isPrimary ? 1 : 0]
    });

    // Mettre à jour image_url du produit si c'est l'image principale
    if (isPrimary) {
        await client.execute({
            sql: `UPDATE products SET image_url = ? WHERE id = ?`,
            args: [imageUrl, productId]
        });
    }
}

// Vérifier que la table product_images existe
async function ensureTableExists() {
    console.log('🔧 Vérification de la table product_images...');

    await client.execute(`
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      is_primary BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

    console.log('✅ Table product_images prête');
}

async function main() {
    console.log('🚀 Démarrage de l\'upload des images vers Vercel Blob...\n');

    // Vérifier les variables d'environnement
    if (!process.env.TURSO_DATABASE_URL) {
        console.error('❌ TURSO_DATABASE_URL non défini');
        process.exit(1);
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error('❌ BLOB_READ_WRITE_TOKEN non défini (nécessaire pour Vercel Blob)');
        console.error('   Ajoute cette variable dans ton .env');
        process.exit(1);
    }

    // S'assurer que la table existe
    await ensureTableExists();

    // Récupérer tous les produits
    const result = await client.execute('SELECT * FROM products ORDER BY id');
    const products = result.rows;

    console.log(`📦 ${products.length} produits trouvés dans Turso\n`);

    // Lister les images locales
    const imageFiles = fs.readdirSync(IMAGES_DIR)
        .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
        .sort();

    console.log(`🖼️  ${imageFiles.length} images trouvées localement\n`);

    if (products.length === 0) {
        console.log('⚠️  Aucun produit dans la base de données');
        process.exit(0);
    }

    if (imageFiles.length === 0) {
        console.log('⚠️  Aucune image dans le dossier');
        process.exit(0);
    }

    // Stratégie: distribuer les images aux produits
    // On groupe les images par "lot" basé sur les timestamps similaires

    // D'abord, on nettoie les images existantes
    console.log('🧹 Nettoyage des anciennes associations...');
    await client.execute('DELETE FROM product_images');
    await client.execute('UPDATE products SET image_url = NULL');
    console.log('✅ Anciennes associations supprimées\n');

    // Upload et association pour chaque produit
    // On distribue les images équitablement
    const imagesPerProduct = Math.ceil(imageFiles.length / products.length);
    let imageIndex = 0;

    for (const product of products) {
        console.log(`\n📦 Produit: ${product.name} (ID: ${product.id})`);

        const productImages = [];
        for (let i = 0; i < imagesPerProduct && imageIndex < imageFiles.length; i++) {
            productImages.push(imageFiles[imageIndex]);
            imageIndex++;
        }

        if (productImages.length === 0) {
            console.log('  ⚠️  Pas d\'image disponible pour ce produit');
            continue;
        }

        for (let order = 0; order < productImages.length; order++) {
            const imageName = productImages[order];
            const imagePath = path.join(IMAGES_DIR, imageName);
            const isPrimary = order === 0;

            try {
                const blobUrl = await uploadImageToBlob(imagePath, imageName);
                await associateImageToProduct(product.id, blobUrl, order + 1, isPrimary);
                console.log(`  ✅ Image ${order + 1}/${productImages.length} associée`);
            } catch (err) {
                console.error(`  ❌ Erreur pour ${imageName}:`, err.message);
            }
        }
    }

    console.log('\n\n🎉 Upload terminé !');
    console.log('📊 Vérification finale...');

    // Vérification
    const finalCheck = await client.execute('SELECT COUNT(*) as count FROM product_images');
    console.log(`   ${finalCheck.rows[0].count} images associées dans la base`);

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
});
