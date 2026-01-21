/**
 * Script d'upload des images boutique/atelier vers Vercel Blob
 * 
 * Usage: node scripts/uploadBoutiqueImages.js
 */

const { put } = require('@vercel/blob');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Dossier des images boutique locales
const BOUTIQUE_DIR = path.join(__dirname, '../public/images/boutique');

// Fichier de mapping pour stocker les URLs Blob
const MAPPING_FILE = path.join(__dirname, '../public/images/boutique-mapping.json');

// Fonction pour compresser et uploader une image vers Vercel Blob
async function uploadImageToBlob(filePath, originalName) {
    console.log(`  📤 Upload: ${originalName}...`);

    const fileBuffer = fs.readFileSync(filePath);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.webp';

    // Compresser l'image avec sharp
    const compressedBuffer = await sharp(fileBuffer)
        .resize(1200, 1200, {
            fit: 'inside',
            withoutEnlargement: true
        })
        .webp({ quality: 85 })
        .toBuffer();

    // Upload vers Vercel Blob dans le dossier boutique/
    const blob = await put(`boutique/${uniqueName}`, compressedBuffer, {
        access: 'public',
        contentType: 'image/webp'
    });

    console.log(`  ✅ Uploadé: ${blob.url}`);
    return blob.url;
}

async function main() {
    console.log('🚀 Démarrage de l\'upload des images boutique vers Vercel Blob...\n');

    // Vérifier les variables d'environnement
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error('❌ BLOB_READ_WRITE_TOKEN non défini');
        console.error('   Ajoute cette variable dans ton .env');
        process.exit(1);
    }

    // Vérifier que le dossier existe
    if (!fs.existsSync(BOUTIQUE_DIR)) {
        console.error('❌ Dossier boutique non trouvé:', BOUTIQUE_DIR);
        process.exit(1);
    }

    // Lister les images
    const imageFiles = fs.readdirSync(BOUTIQUE_DIR)
        .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
        .sort();

    console.log(`🖼️  ${imageFiles.length} images trouvées\n`);

    if (imageFiles.length === 0) {
        console.log('⚠️  Aucune image dans le dossier boutique');
        process.exit(0);
    }

    // Upload et création du mapping
    const mapping = {};

    for (const imageName of imageFiles) {
        const imagePath = path.join(BOUTIQUE_DIR, imageName);

        try {
            const blobUrl = await uploadImageToBlob(imagePath, imageName);
            mapping[imageName] = blobUrl;
        } catch (err) {
            console.error(`  ❌ Erreur pour ${imageName}:`, err.message);
        }
    }

    // Sauvegarder le mapping
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
    console.log(`\n📄 Mapping sauvegardé dans: ${MAPPING_FILE}`);

    console.log('\n\n🎉 Upload terminé !');
    console.log(`📊 ${Object.keys(mapping).length} images uploadées`);

    // Afficher les URLs pour mise à jour du code
    console.log('\n📋 URLs générées (pour mise à jour du code):');
    Object.entries(mapping).forEach(([name, url]) => {
        console.log(`   ${name} → ${url}`);
    });

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
});
