// Check and reseed database
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('Checking users in database...');

    const users = await prisma.user.findMany();
    console.log('Found users:', users.length);

    if (users.length === 0) {
        console.log('No users found. Creating admin user...');
        const hashedPassword = await bcrypt.hash('password123', 10);

        const admin = await prisma.user.create({
            data: {
                username: 'admin',
                password: hashedPassword,
                role: 'ADMIN',
            },
        });
        console.log('Admin user created:', admin.username);
    } else {
        console.log('Existing users:');
        users.forEach(u => console.log(`  - ${u.username} (${u.role})`));

        // Update admin password to ensure it's correct
        const hashedPassword = await bcrypt.hash('password123', 10);
        await prisma.user.updateMany({
            where: { username: 'admin' },
            data: { password: hashedPassword }
        });
        console.log('Admin password reset to: password123');
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
        console.log('Done!');
    })
    .catch(async (e) => {
        console.error('Error:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
