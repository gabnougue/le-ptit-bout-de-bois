const express = require('express');
const router = express.Router();
const db = require('../models/database');

// Middleware de vérification admin
const requireAdmin = (req, res, next) => {
  if (!req.session.adminId) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
};

// Récupérer tous les paramètres
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM settings', []);

    // Convertir en objet clé-valeur
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });

    res.json(settings);
  } catch (error) {
    console.error('Erreur récupération paramètres:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour un paramètre
router.put('/:key', requireAdmin, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  try {
    await db.run(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `, [key, value, value]);

    res.json({
      success: true,
      message: 'Paramètre mis à jour'
    });
  } catch (error) {
    console.error('Erreur mise à jour paramètre:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GESTION DES CATEGORIES =====

// Récupérer toutes les catégories (public)
router.get('/categories', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM categories ORDER BY name ASC', []);
    res.json(rows);
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ajouter une catégorie (admin)
router.post('/categories', requireAdmin, async (req, res) => {
  const { name, emoji, description, parent_id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nom de catégorie requis' });
  }

  try {
    const result = await db.run(
      'INSERT INTO categories (name, emoji, description, parent_id) VALUES (?, ?, ?, ?)',
      [name.trim(), emoji || '🪵', description || '', parent_id || null]
    );

    res.json({
      success: true,
      message: 'Catégorie ajoutée',
      category: {
        id: result.id,
        name: name.trim(),
        emoji: emoji || '🪵',
        description: description || '',
        parent_id: parent_id || null
      }
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Cette catégorie existe déjà' });
    }
    console.error('Erreur ajout catégorie:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modifier une catégorie (admin)
router.put('/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, emoji, description, parent_id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nom de catégorie requis' });
  }

  try {
    // Récupérer l'ancien nom pour mettre à jour les produits
    const oldCat = await db.get('SELECT name FROM categories WHERE id = ?', [id]);
    const oldName = oldCat ? oldCat.name : null;

    const result = await db.run(
      'UPDATE categories SET name = ?, emoji = ?, description = ?, parent_id = ? WHERE id = ?',
      [name.trim(), emoji || '🪵', description || '', parent_id || null, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    // Mettre à jour la catégorie dans les produits associés
    if (oldName && oldName !== name.trim()) {
      await db.run('UPDATE products SET category = ? WHERE category = ?', [name.trim(), oldName]);
    }

    res.json({
      success: true,
      message: 'Catégorie modifiée',
      category: {
        id: parseInt(id),
        name: name.trim(),
        emoji: emoji || '🪵',
        description: description || ''
      }
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Cette catégorie existe déjà' });
    }
    console.error('Erreur modification catégorie:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une catégorie (admin)
router.delete('/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Vérifier si des sous-catégories existent
    const subCount = await db.get('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?', [id]);
    if (subCount.count > 0) {
      return res.status(400).json({
        error: `Impossible de supprimer : ${subCount.count} sous-catégorie(s) existent. Supprimez-les d'abord.`
      });
    }

    // Vérifier si des produits utilisent cette catégorie
    const row = await db.get(
      'SELECT COUNT(*) as count FROM products WHERE category = (SELECT name FROM categories WHERE id = ?)',
      [id]
    );

    if (row.count > 0) {
      return res.status(400).json({
        error: `Impossible de supprimer : ${row.count} produit(s) utilisent cette catégorie`
      });
    }

    // Supprimer la catégorie
    const result = await db.run('DELETE FROM categories WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    res.json({
      success: true,
      message: 'Catégorie supprimée'
    });
  } catch (error) {
    console.error('Erreur suppression catégorie:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GESTION DES TYPES DE BOIS =====

// Récupérer tous les types de bois (public)
router.get('/wood-types', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM wood_types ORDER BY name ASC', []);
    res.json(rows);
  } catch (error) {
    console.error('Erreur récupération types de bois:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ajouter un type de bois (admin)
router.post('/wood-types', requireAdmin, async (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nom de type de bois requis' });
  }

  try {
    const result = await db.run(
      'INSERT INTO wood_types (name, description) VALUES (?, ?)',
      [name.trim(), description || '']
    );

    res.json({
      success: true,
      message: 'Type de bois ajouté',
      woodType: {
        id: result.id,
        name: name.trim(),
        description: description || ''
      }
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ce type de bois existe déjà' });
    }
    console.error('Erreur ajout type de bois:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modifier un type de bois (admin)
router.put('/wood-types/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nom de type de bois requis' });
  }

  try {
    await db.run(
      'UPDATE wood_types SET name = ?, description = ? WHERE id = ?',
      [name.trim(), description || '', id]
    );
    res.json({ success: true, woodType: { id: parseInt(id), name: name.trim(), description: description || '' } });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ce type de bois existe déjà' });
    }
    console.error('Erreur modification type de bois:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un type de bois (admin)
router.delete('/wood-types/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Vérifier si des produits utilisent ce type de bois
    const row = await db.get(
      'SELECT COUNT(*) as count FROM products WHERE wood_type = (SELECT name FROM wood_types WHERE id = ?)',
      [id]
    );

    if (row.count > 0) {
      return res.status(400).json({
        error: `Impossible de supprimer : ${row.count} produit(s) utilisent ce type de bois`
      });
    }

    // Supprimer le type de bois
    const result = await db.run('DELETE FROM wood_types WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Type de bois non trouvé' });
    }

    res.json({
      success: true,
      message: 'Type de bois supprimé'
    });
  } catch (error) {
    console.error('Erreur suppression type de bois:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
