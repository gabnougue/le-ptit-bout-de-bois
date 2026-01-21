const express = require('express');
const router = express.Router();
const db = require('../models/database');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const { put } = require('@vercel/blob');

// Configuration de multer avec stockage en mémoire pour traitement avec sharp
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max en entrée
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Seules les images sont autorisées'));
  }
});

// Fonction pour compresser et sauvegarder une image (via Vercel Blob)
async function processAndSaveImage(fileBuffer, originalName) {
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

  // Retourner l'URL complète du blob
  return blob.url;
}

// Rate limiting strict pour le login admin
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware de vérification admin
const requireAdmin = (req, res, next) => {
  if (!req.session.adminId) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
};

// Login admin avec rate limiting
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiants manquants' });
  }

  try {
    const admin = await db.get('SELECT * FROM admins WHERE username = ?', [username]);

    if (!admin) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;

    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Logout admin
router.post('/logout', (req, res) => {
  // Avec cookie-session, on détruit la session en la mettant à null
  req.session = null;
  res.json({ success: true });
});

// Vérifier la session
router.get('/check-session', (req, res) => {
  if (req.session.adminId) {
    res.json({
      authenticated: true,
      username: req.session.adminUsername
    });
  } else {
    res.json({ authenticated: false });
  }
});

// CRUD Produits

// Créer un produit (avec plusieurs images)
router.post('/products', requireAdmin, (req, res, next) => {
  upload.fields([{ name: 'images', maxCount: 10 }])(req, res, (err) => {
    if (err) {
      console.error('Erreur upload:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  const { name, description, wood_type, price, category, stock, perlouze_link } = req.body;

  try {
    // Insérer le produit
    const result = await db.run(`
      INSERT INTO products (name, description, wood_type, price, category, stock, perlouze_link)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, description, wood_type, price, category, stock, perlouze_link || null]);

    const productId = result.id;

    // Gérer les images si présentes
    if (req.files && req.files.images && req.files.images.length > 0) {
      const images = req.files.images;
      let primaryImageUrl = null;

      for (let index = 0; index < images.length; index++) {
        const file = images[index];
        // Upload vers Vercel Blob avec compression
        const imageUrl = await processAndSaveImage(file.buffer, file.originalname);
        const isPrimary = index === 0 ? 1 : 0;

        if (isPrimary) {
          primaryImageUrl = imageUrl;
        }

        await db.run(`
          INSERT INTO product_images (product_id, image_path, display_order, is_primary)
          VALUES (?, ?, ?, ?)
        `, [productId, imageUrl, index + 1, isPrimary]);
      }

      // Mettre à jour image_url du produit avec la première image
      if (primaryImageUrl) {
        await db.run(`UPDATE products SET image_url = ? WHERE id = ?`, [primaryImageUrl, productId]);
      }

      res.json({
        success: true,
        productId: productId,
        imagesCount: images.length,
        message: 'Produit créé avec succès'
      });
    } else {
      // Aucune image
      res.json({
        success: true,
        productId: productId,
        message: 'Produit créé avec succès (sans images)'
      });
    }
  } catch (error) {
    console.error('Erreur création produit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modifier un produit (ajout de nouvelles images)
router.put('/products/:id', requireAdmin, (req, res, next) => {
  upload.fields([{ name: 'images', maxCount: 10 }])(req, res, (err) => {
    if (err) {
      console.error('Erreur upload:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  const { id } = req.params;
  const { name, description, wood_type, price, category, stock, perlouze_link } = req.body;

  try {
    // Mettre à jour les informations du produit
    await db.run(`
      UPDATE products
      SET name = ?, description = ?, wood_type = ?, price = ?, category = ?,
          stock = ?, perlouze_link = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description, wood_type, price, category, stock, perlouze_link || null, id]);

    // Ajouter les nouvelles images si présentes
    if (req.files && req.files.images && req.files.images.length > 0) {
      // Trouver l'ordre maximal actuel
      const row = await db.get(`SELECT MAX(display_order) as maxOrder FROM product_images WHERE product_id = ?`, [id]);
      const startOrder = (row && row.maxOrder !== null) ? row.maxOrder + 1 : 1;
      const images = req.files.images;

      for (let index = 0; index < images.length; index++) {
        const file = images[index];
        // Upload vers Vercel Blob avec compression
        const imageUrl = await processAndSaveImage(file.buffer, file.originalname);

        await db.run(`
          INSERT INTO product_images (product_id, image_path, display_order, is_primary)
          VALUES (?, ?, ?, 0)
        `, [id, imageUrl, startOrder + index]);
      }

      res.json({
        success: true,
        imagesAdded: images.length,
        message: 'Produit modifié avec succès'
      });
    } else {
      res.json({
        success: true,
        message: 'Produit modifié avec succès'
      });
    }
  } catch (error) {
    console.error('Erreur modification produit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un produit
router.delete('/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await db.run('DELETE FROM products WHERE id = ?', [id]);
    res.json({
      success: true,
      message: 'Produit supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur suppression produit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fonction utilitaire pour enrichir un produit avec ses images (admin)
async function enrichProductAdmin(product) {
  try {
    const images = await db.all(
      `SELECT id, image_path, display_order, is_primary
       FROM product_images
       WHERE product_id = ?
       ORDER BY display_order ASC`,
      [product.id]
    );

    product.images = images || [];
    product.image_paths = images.map(img => img.image_path);
    return product;
  } catch (err) {
    throw err;
  }
}

// Enrichir plusieurs produits (admin)
async function enrichProductsAdmin(products) {
  const enrichedProducts = [];
  for (const product of products) {
    try {
      const enriched = await enrichProductAdmin(product);
      enrichedProducts.push(enriched);
    } catch (err) {
      console.error('Erreur enrichissement produit:', err);
      enrichedProducts.push(product);
    }
  }
  return enrichedProducts;
}

// Récupérer tous les produits (y compris en rupture)
router.get('/products', requireAdmin, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM products ORDER BY created_at DESC', []);

    // Enrichir avec les images
    const enrichedProducts = await enrichProductsAdmin(rows);
    res.json(enrichedProducts);
  } catch (error) {
    console.error('Erreur récupération produits admin:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une image spécifique
router.delete('/product-images/:id', requireAdmin, async (req, res) => {
  const imageId = req.params.id;

  try {
    // Récupérer d'abord l'image pour connaître le product_id
    const image = await db.get('SELECT * FROM product_images WHERE id = ?', [imageId]);

    if (!image) {
      return res.status(404).json({ error: 'Image non trouvée' });
    }

    const productId = image.product_id;
    const wasPrimary = image.is_primary;

    // Supprimer l'image
    await db.run('DELETE FROM product_images WHERE id = ?', [imageId]);

    // Si c'était l'image principale, promouvoir la première image restante
    if (wasPrimary) {
      const firstImage = await db.get(
        'SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order ASC LIMIT 1',
        [productId]
      );

      if (firstImage) {
        // Mettre cette image en principale
        await db.run('UPDATE product_images SET is_primary = 1 WHERE id = ?', [firstImage.id]);
        // Mettre à jour le produit
        await db.run('UPDATE products SET image_url = ? WHERE id = ?', [firstImage.image_path, productId]);
      } else {
        // Plus d'images, mettre à NULL
        await db.run('UPDATE products SET image_url = NULL WHERE id = ?', [productId]);
      }
    }

    res.json({ success: true, message: 'Image supprimée' });
  } catch (error) {
    console.error('Erreur suppression image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Réorganiser les images d'un produit
router.put('/products/:id/reorder-images', requireAdmin, async (req, res) => {
  const productId = req.params.id;
  const { images } = req.body; // Array d'objets {id, display_order, is_primary}

  if (!images || !Array.isArray(images)) {
    return res.status(400).json({ error: 'Données invalides' });
  }

  try {
    let primaryImagePath = null;

    for (const img of images) {
      await db.run(
        'UPDATE product_images SET display_order = ?, is_primary = ? WHERE id = ?',
        [img.display_order, img.is_primary, img.id]
      );

      // Trouver le chemin de l'image principale
      if (img.is_primary) {
        const row = await db.get('SELECT image_path FROM product_images WHERE id = ?', [img.id]);
        if (row) {
          primaryImagePath = row.image_path;
        }
      }
    }

    // Mettre à jour le produit avec la nouvelle image principale
    if (primaryImagePath) {
      await db.run('UPDATE products SET image_url = ? WHERE id = ?', [primaryImagePath, productId]);
    }

    res.json({ success: true, message: 'Images réorganisées' });
  } catch (error) {
    console.error('Erreur réorganisation images:', error);
    res.status(500).json({ error: error.message });
  }
});

// Statistiques du dashboard
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [totalProducts, ongoingOrders, totalRevenue, outOfStock] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM products', []),
      db.get('SELECT COUNT(*) as count FROM orders WHERE status != "delivered"', []),
      db.get('SELECT SUM(total_amount) as total FROM orders WHERE status = "delivered"', []),
      db.get('SELECT COUNT(*) as count FROM products WHERE stock = 0', [])
    ]);

    res.json({
      totalProducts: totalProducts ? totalProducts.count : 0,
      ongoingOrders: ongoingOrders ? ongoingOrders.count : 0,
      totalRevenue: totalRevenue && totalRevenue.total ? totalRevenue.total : 0,
      outOfStock: outOfStock ? outOfStock.count : 0
    });
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload en masse des images locales vers Vercel Blob
// Endpoint temporaire pour la migration des images
const fs = require('fs');

router.post('/bulk-upload-local-images', requireAdmin, async (req, res) => {
  const imagesDir = path.join(__dirname, '../../public/images/products');

  try {
    // Vérifier que le dossier existe
    if (!fs.existsSync(imagesDir)) {
      return res.status(400).json({ error: 'Dossier images/products non trouvé' });
    }

    // Lister les images
    const imageFiles = fs.readdirSync(imagesDir)
      .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file) && file !== '.gitkeep')
      .sort();

    if (imageFiles.length === 0) {
      return res.status(400).json({ error: 'Aucune image trouvée dans le dossier' });
    }

    // Récupérer tous les produits
    const products = await db.all('SELECT * FROM products ORDER BY id');

    if (products.length === 0) {
      return res.status(400).json({ error: 'Aucun produit dans la base de données' });
    }

    console.log(`🖼️  ${imageFiles.length} images à uploader pour ${products.length} produits`);

    // Nettoyer les anciennes associations
    await db.run('DELETE FROM product_images');
    await db.run('UPDATE products SET image_url = NULL');

    // Distribuer les images aux produits
    const imagesPerProduct = Math.ceil(imageFiles.length / products.length);
    let imageIndex = 0;
    const results = [];

    for (const product of products) {
      const productImages = [];

      for (let i = 0; i < imagesPerProduct && imageIndex < imageFiles.length; i++) {
        productImages.push(imageFiles[imageIndex]);
        imageIndex++;
      }

      if (productImages.length === 0) continue;

      for (let order = 0; order < productImages.length; order++) {
        const imageName = productImages[order];
        const imagePath = path.join(imagesDir, imageName);
        const isPrimary = order === 0;

        try {
          // Lire et compresser l'image
          const fileBuffer = fs.readFileSync(imagePath);
          const blobUrl = await processAndSaveImage(fileBuffer, imageName);

          // Insérer dans product_images
          await db.run(`
            INSERT INTO product_images (product_id, image_path, display_order, is_primary)
            VALUES (?, ?, ?, ?)
          `, [product.id, blobUrl, order + 1, isPrimary ? 1 : 0]);

          // Mettre à jour image_url si primaire
          if (isPrimary) {
            await db.run('UPDATE products SET image_url = ? WHERE id = ?', [blobUrl, product.id]);
          }

          results.push({
            productId: product.id,
            productName: product.name,
            imageName,
            blobUrl,
            isPrimary
          });

          console.log(`  ✅ ${imageName} → ${product.name}`);
        } catch (err) {
          console.error(`  ❌ Erreur ${imageName}:`, err.message);
          results.push({
            productId: product.id,
            imageName,
            error: err.message
          });
        }
      }
    }

    res.json({
      success: true,
      message: `${results.filter(r => r.blobUrl).length} images uploadées avec succès`,
      totalImages: imageFiles.length,
      totalProducts: products.length,
      results
    });

  } catch (error) {
    console.error('Erreur bulk upload:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
