const express = require('express');
const router = express.Router();
const db = require('../models/database');
const multer = require('multer');
const path = require('path');
const { put, del } = require('@vercel/blob');

// Middleware pour vérifier l'authentification admin
const requireAdmin = (req, res, next) => {
  if (!req.session.adminId) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
};

// Configuration multer pour l'upload en mémoire (pour transfert vers Blob)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'));
    }
  }
});

// Récupérer toutes les images de la boutique
router.get('/images', async (req, res) => {
  try {
    // On ne fait plus de synchronisation avec le dossier local car on utilise le Blob Storage
    // Les images sont uniquement gérées via la base de données

    // Retourner toutes les images
    const images = await db.all(
      'SELECT * FROM boutique_images ORDER BY display_order ASC'
    );
    res.json(images);
  } catch (error) {
    console.error('Erreur récupération images boutique:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ajouter une nouvelle image (Upload vers Vercel Blob)
router.post('/images', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }

    // Générer un nom unique
    const ext = path.extname(req.file.originalname);
    const filename = `boutique/${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;

    // Upload vers Vercel Blob
    const blob = await put(filename, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype
    });

    const imagePath = blob.url;

    // Obtenir le dernier display_order
    const lastImage = await db.get(
      'SELECT MAX(display_order) as maxOrder FROM boutique_images'
    );
    const newOrder = (lastImage?.maxOrder || 0) + 1;

    const result = await db.run(
      'INSERT INTO boutique_images (image_path, display_order) VALUES (?, ?)',
      [imagePath, newOrder]
    );

    res.json({
      id: result.id,
      image_path: imagePath,
      display_order: newOrder
    });
  } catch (error) {
    console.error('Erreur ajout image boutique (Blob):', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une image (Suppression du Blob)
router.delete('/images/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer l'image pour supprimer le fichier
    const image = await db.get(
      'SELECT * FROM boutique_images WHERE id = ?',
      [id]
    );

    if (!image) {
      return res.status(404).json({ error: 'Image non trouvée' });
    }

    // Supprimer le fichier du Blob s'il s'agit d'une URL absolue (Blob)
    // Si c'est un chemin local ancien (/images/boutique/...), on ne peut pas le supprimer du blob (sauf si on a migré)
    // Mais on peut essayer de supprimer du disque si nécessaire, ou juste ignorer.
    if (image.image_path.startsWith('http')) {
      try {
        await del(image.image_path);
      } catch (blobError) {
        console.error('Erreur suppression Blob:', blobError);
        // On continue quand même pour supprimer de la DB
      }
    } else {
      // Fallback: tentative suppression locale (pour rétrocompatibilité locale)
      const fs = require('fs').promises;
      const localPath = path.join(__dirname, '../../public', image.image_path);
      try {
        await fs.unlink(localPath);
      } catch (e) { }
    }

    // Supprimer de la base de données
    await db.run('DELETE FROM boutique_images WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression image boutique:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour l'ordre des images
router.put('/images/reorder', requireAdmin, async (req, res) => {
  try {
    const { images } = req.body; // Array d'objets {id, display_order}

    if (!Array.isArray(images)) {
      return res.status(400).json({ error: 'Format invalide' });
    }

    // Mettre à jour l'ordre de chaque image
    for (const img of images) {
      await db.run(
        'UPDATE boutique_images SET display_order = ? WHERE id = ?',
        [img.display_order, img.id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur réorganisation images:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
