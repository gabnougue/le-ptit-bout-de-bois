const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config();

const LOCAL_DB_PATH = path.join(__dirname, '../database.db');
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
    console.error('❌ Config Turso manquante');
    process.exit(1);
}

async function migrate() {
    console.log('🚀 Démarrage migration messagerie...');

    const local = createClient({ url: `file:${LOCAL_DB_PATH}` });
    const prod = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

    try {
        // 1. Création des tables manquantes
        console.log('🏗️  Vérification/Création des tables sur Turso...');

        await prod.execute(`
            CREATE TABLE IF NOT EXISTS message_threads (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              contact_id INTEGER,
              subject TEXT NOT NULL,
              customer_name TEXT NOT NULL,
              customer_email TEXT NOT NULL,
              status TEXT DEFAULT 'open',
              last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              admin_last_viewed_at DATETIME DEFAULT NULL
              -- Note: FK constraint removed/relaxed to avoid issues if contacts missing
            )
        `);

        await prod.execute(`
            CREATE TABLE IF NOT EXISTS thread_messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              thread_id INTEGER NOT NULL,
              sender_type TEXT NOT NULL CHECK(sender_type IN ('customer', 'admin')),
              sender_name TEXT NOT NULL,
              sender_email TEXT NOT NULL,
              message TEXT NOT NULL,
              has_attachments BOOLEAN DEFAULT 0,
              resend_email_id TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE
            )
        `);

        await prod.execute(`
            CREATE TABLE IF NOT EXISTS message_attachments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              message_id INTEGER NOT NULL,
              filename TEXT NOT NULL,
              file_path TEXT NOT NULL,
              file_size INTEGER,
              mime_type TEXT,
              content TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (message_id) REFERENCES thread_messages(id) ON DELETE CASCADE
            )
        `);

        // Ajouter la colonne content si elle n'existe pas
        try {
            await prod.execute('ALTER TABLE message_attachments ADD COLUMN content TEXT');
            console.log('✅ Colonne content ajoutée à message_attachments');
        } catch (e) {
            console.log('ℹ️ Colonne content déjà présente');
        }

        // 2. Migration des CONTACTS (si table contacts existe deja en prod, on injecte les manquants)
        console.log('👥 Migration contacts...');
        const localContacts = await local.execute('SELECT * FROM contacts');

        for (const c of localContacts.rows) {
            const exists = await prod.execute({ sql: 'SELECT id FROM contacts WHERE id = ?', args: [c.id] });
            if (exists.rows.length === 0) {
                await prod.execute({
                    sql: 'INSERT INTO contacts (id, name, email, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    args: [c.id, c.name, c.email, c.message, c.status, c.created_at]
                });
            }
        }

        // 3. Migration Threads
        console.log('🧵 Migration threads...');
        const localThreads = await local.execute('SELECT * FROM message_threads');

        for (const t of localThreads.rows) {
            const exists = await prod.execute({ sql: 'SELECT id FROM message_threads WHERE id = ?', args: [t.id] });
            if (exists.rows.length === 0) {
                await prod.execute({
                    sql: `INSERT INTO message_threads (
                        id, contact_id, subject, customer_name, customer_email, 
                        status, last_message_at, created_at, admin_last_viewed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        t.id, t.contact_id, t.subject, t.customer_name, t.customer_email,
                        t.status, t.last_message_at, t.created_at, t.admin_last_viewed_at
                    ]
                });
            }
        }

        // 4. Migration Messages
        console.log('💬 Migration messages...');
        const localMsgs = await local.execute('SELECT * FROM thread_messages');

        for (const m of localMsgs.rows) {
            const exists = await prod.execute({ sql: 'SELECT id FROM thread_messages WHERE id = ?', args: [m.id] });
            if (exists.rows.length === 0) {
                await prod.execute({
                    sql: `INSERT INTO thread_messages (
                        id, thread_id, sender_type, sender_name, sender_email, 
                        message, has_attachments, resend_email_id, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        m.id, m.thread_id, m.sender_type, m.sender_name, m.sender_email,
                        m.message, m.has_attachments, m.resend_email_id, m.created_at
                    ]
                });
            }
        }

        // 5. Migration Attachments
        console.log('📎 Migration attachments...');
        const localAtt = await local.execute('SELECT * FROM message_attachments');

        for (const a of localAtt.rows) {
            const exists = await prod.execute({ sql: 'SELECT id FROM message_attachments WHERE id = ?', args: [a.id] });
            if (exists.rows.length === 0) {
                await prod.execute({
                    sql: `INSERT INTO message_attachments (
                        id, message_id, filename, file_path, file_size, mime_type, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        a.id, a.message_id, a.filename, a.file_path,
                        a.file_size, a.mime_type, a.created_at
                    ]
                });
            }
        }

        console.log('✅ Migration messagerie terminée avec succès !');

    } catch (err) {
        console.error('❌ Erreur migration:', err);
    } finally {
        local.close();
        prod.close();
    }
}

migrate();
