const { createClient } = require('@libsql/client');
const path = require('path');

const dbPath = path.join(__dirname, '../database.db');
const client = createClient({ url: `file:${dbPath}` });

async function getTableSchema(tableName) {
    try {
        const result = await client.execute({
            sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
            args: [tableName]
        });

        if (result.rows.length > 0) {
            console.log(`\n--- Schema de ${tableName} ---`);
            console.log(result.rows[0].sql);
            return result.rows[0].sql;
        } else {
            console.log(`\n❌ Table ${tableName} non trouvée.`);
            return null;
        }

    } catch (err) {
        console.error(err);
    }
}

async function main() {
    await getTableSchema('message_threads');
    await getTableSchema('thread_messages');
    await getTableSchema('message_attachments');
    // Aussi contacts, on sait jamais si lié
    await getTableSchema('contacts');
}

main();
