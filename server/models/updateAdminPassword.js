// Script pour mettre à jour le mot de passe admin
// Usage: node server/models/updateAdminPassword.js

require('dotenv').config();
const bcrypt = require('bcrypt');
const { createClient } = require('@libsql/client');

async function updateAdminPassword() {
    const db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    const newPassword = process.env.ADMIN_PASSWORD || '***MOT_DE_PASSE_RETIRE***';

    console.log('🔐 Mise à jour du mot de passe admin...');

    try {
        // Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Mettre à jour dans la base de données
        await db.execute({
            sql: 'UPDATE admins SET password = ? WHERE username = ?',
            args: [hashedPassword, 'admin']
        });

        console.log('✅ Mot de passe admin mis à jour avec succès !');
        console.log('   Username: admin');
        console.log('   Nouveau mot de passe: ' + newPassword);

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

updateAdminPassword();
