const express = require('express');
const router = express.Router();
const db = require('../models/database');

// Fonction utilitaire pour enrichir un produit avec ses images
async function enrichProduct(product) {
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

// Enrichir plusieurs produits
async function enrichProducts(products) {
  const enrichedProducts = [];
  for (const product of products) {
    try {
      const enriched = await enrichProduct(product);
      enrichedProducts.push(enriched);
    } catch (err) {
      console.error('Erreur enrichissement produit:', err);
      enrichedProducts.push(product); // Retourner le produit sans enrichissement
    }
  }
  return enrichedProducts;
}

// Récupérer tous les produits
router.get('/', async (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM products WHERE stock > 0';
  const params = [];

  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ? OR wood_type LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const rows = await db.all(query, params);
    const enrichedProducts = await enrichProducts(rows);
    res.json(enrichedProducts);
  } catch (error) {
    console.error('Erreur récupération produits:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les produits coups de cœur (page d'accueil)
router.get('/featured', async (req, res) => {
  try {
    let products = await db.all(
      'SELECT * FROM products WHERE is_featured = 1 AND stock > 0 LIMIT 3'
    );
    // Fallback : les 3 plus récents si aucun coup de cœur défini
    if (products.length === 0) {
      products = await db.all(
        'SELECT * FROM products WHERE stock > 0 ORDER BY created_at DESC LIMIT 3'
      );
    }
    const enrichedProducts = await enrichProducts(products);
    res.json(enrichedProducts);
  } catch (error) {
    console.error('Erreur récupération produits phares:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un produit par ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const row = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!row) {
      res.status(404).json({ error: 'Produit non trouvé' });
      return;
    }

    const enrichedProduct = await enrichProduct(row);
    res.json(enrichedProduct);
  } catch (error) {
    console.error('Erreur récupération produit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les catégories
router.get('/meta/categories', async (req, res) => {
  try {
    const rows = await db.all('SELECT DISTINCT category FROM products ORDER BY category', []);
    const categories = rows.map(row => row.category);
    res.json(categories);
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les types de bois
router.get('/meta/wood-types', async (req, res) => {
  try {
    const rows = await db.all('SELECT DISTINCT wood_type FROM products WHERE wood_type IS NOT NULL AND wood_type != "" ORDER BY wood_type', []);
    const woodTypes = rows.map(row => row.wood_type);
    res.json(woodTypes);
  } catch (error) {
    console.error('Erreur récupération types de bois:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
