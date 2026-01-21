const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { sendOrderNotification, sendCustomerOrderEmail } = require('../services/email');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Créer une intention de paiement Stripe
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Paiement non configuré' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convertir en centimes
      currency: 'eur',
      payment_method_types: ['card', 'paypal'],
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Erreur lors de la création du paiement:', error);
    res.status(500).json({ error: 'Erreur lors de la création du paiement' });
  }
});

// Créer une nouvelle commande
router.post('/', async (req, res) => {
  const {
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
    items,
    subtotal,
    shippingCost,
    totalAmount,
    paymentMethod,
    paymentId
  } = req.body;

  // Validation
  if (!customerName || !customerEmail || !items || !totalAmount) {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  const itemsJson = JSON.stringify(items);

  try {
    const result = await db.run(`
      INSERT INTO orders (customer_name, customer_email, customer_phone, customer_address,
                         items, subtotal, shipping_cost, total_amount, payment_method, payment_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      customerName,
      customerEmail,
      customerPhone || null,
      customerAddress || null,
      itemsJson,
      subtotal || 0,
      shippingCost || 0,
      totalAmount,
      paymentMethod || 'card',
      paymentId || null,
      'pending'
    ]);

    const orderId = result.id;

    // Mettre à jour le stock
    for (const item of items) {
      await db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.id]);
    }

    // Récupérer la commande créée pour l'email
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (order) {
      // Convertir les items pour le format attendu par sendOrderNotification
      const orderItems = items.map(item => ({
        product_name: item.name,
        quantity: item.quantity,
        price: item.price
      }));

      // Envoyer l'email de notification au vendeur
      await sendOrderNotification(order, orderItems);

      // Envoyer l'email au client (commande en attente)
      await sendCustomerOrderEmail(order, orderItems, 'pending');
    }

    res.json({
      success: true,
      orderId,
      message: 'Commande créée avec succès'
    });
  } catch (error) {
    console.error('Erreur création commande:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la commande' });
  }
});

// Récupérer toutes les commandes (admin)
router.get('/', async (req, res) => {
  if (!req.session.adminId) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    const rows = await db.all('SELECT * FROM orders ORDER BY created_at DESC', []);

    // Parser les items JSON
    const orders = rows.map(order => ({
      ...order,
      items: JSON.parse(order.items)
    }));

    res.json(orders);
  } catch (error) {
    console.error('Erreur récupération commandes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour le statut d'une commande
router.patch('/:id/status', async (req, res) => {
  if (!req.session.adminId) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const { id } = req.params;
  const { status } = req.body;

  try {
    await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

    // Récupérer la commande pour envoyer l'email au client
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (order) {
      // Parser les items de la commande
      const items = JSON.parse(order.items);

      // Envoyer l'email au client selon le nouveau statut
      await sendCustomerOrderEmail(order, items, status);
    }

    res.json({ success: true, message: 'Statut mis à jour' });
  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
