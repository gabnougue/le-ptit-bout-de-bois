const { createClient } = require('@libsql/client');
const path = require('path');

require('dotenv').config();
const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function listTables() {
    console.log("Connexion à Turso...");
    try {
        const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
        console.log("Tables locales:", result.rows.map(r => r.name));

        // Si la table orders existe, voir ses colonnes
        const cols = await client.execute("PRAGMA table_info(orders)");
        console.log("Colonnes orders:", cols.rows.map(c => c.name));

    } catch (err) {
        console.error(err);
    }
}

listTables();
