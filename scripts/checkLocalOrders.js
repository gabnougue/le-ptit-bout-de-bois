const { createClient } = require('@libsql/client');
const path = require('path');

async function checkDB(filename) {
    const dbPath = path.join(__dirname, '..', filename);
    console.log(`\n📂 Vérification de : ${filename}`);

    try {
        const client = createClient({
            url: `file:${dbPath}`,
        });

        const result = await client.execute("SELECT * FROM orders");

        console.log(`📦 Nombre de commandes trouvées : ${result.rows.length}`);

        result.rows.forEach(order => {
            console.log(`- Commande #${order.id} (${order.customer_name}) - Total: ${order.total_amount}€`);
        });

    } catch (err) {
        console.error(`❌ Erreur ou table 'orders' inexistante dans ${filename}:`, err.message);
    }
}

async function main() {
    await checkDB('database.db');
    await checkDB('server/database.sqlite'); // Au cas où
}

main();
