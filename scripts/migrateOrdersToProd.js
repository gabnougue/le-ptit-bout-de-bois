const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config();

// Configuration
const LOCAL_DB_PATH = path.join(__dirname, '../database.db');
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
    console.error('❌ Erreur: TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN manquant dans .env');
    process.exit(1);
}

async function migrateOrders() {
    console.log('🚀 Démarrage de la migration des commandes...');

    // 1. Connexion à la base LOCALE
    const localClient = createClient({
        url: `file:${LOCAL_DB_PATH}`,
    });
    console.log('✅ Connecté à la base locale');

    // 2. Connexion à la base PRODUCTION (Turso)
    const prodClient = createClient({
        url: TURSO_URL,
        authToken: TURSO_TOKEN,
    });
    console.log('✅ Connecté à la base de production (Turso)');

    try {
        // 3. Récupérer les commandes locales
        const ordersResult = await localClient.execute("SELECT * FROM orders");
        const localOrders = ordersResult.rows;
        console.log(`📦 Commandes trouvées localement : ${localOrders.length}`);

        // 4. (Pas de table order_items séparée, tout est dans orders)

        // 5. Migrer chaque commande
        let successCount = 0;
        let skipCount = 0;

        for (const order of localOrders) {
            // Vérifier si la commande existe déjà en prod (par ID)
            const existing = await prodClient.execute({
                sql: "SELECT id FROM orders WHERE id = ?",
                args: [order.id]
            });

            if (existing.rows.length > 0) {
                console.log(`⚠️ Commande #${order.id} existe déjà en prod -> Ignorée`);
                skipCount++;
                continue;
            }

            console.log(`📤 Migration commande #${order.id} (${order.customer_name})...`);

            // Insérer la commande
            try {
                // On inclut la colonne 'items' qui contient le JSON
                await prodClient.execute({
                    sql: `INSERT INTO orders (
            id, customer_name, customer_email, customer_phone, customer_address, 
            total_amount, status, payment_id, payment_method, shipping_cost, 
            subtotal, created_at, items
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        order.id,
                        order.customer_name,
                        order.customer_email,
                        order.customer_phone,
                        order.customer_address,
                        order.total_amount,
                        order.status,
                        order.payment_id,
                        order.payment_method,
                        order.shipping_cost || 0,
                        order.subtotal || order.total_amount,
                        order.created_at,
                        order.items // JSON string or object
                    ]
                });

                successCount++;
            } catch (err) {
                console.error(`❌ Erreur migration commande #${order.id}:`, err.message);
            }
        }

        console.log('\n🏁 Migration terminée !');
        console.log(`✅ ${successCount} commandes migrées avec succès.`);
        console.log(`⏩ ${skipCount} commandes déjà existantes ignorées.`);

    } catch (err) {
        console.error('❌ Erreur générale:', err);
    } finally {
        localClient.close();
        prodClient.close();
    }
}

migrateOrders();
