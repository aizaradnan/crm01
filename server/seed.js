// Simple seed script to create admin user with new schema
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: { password: hashedPassword },
        create: {
            username: 'admin',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });

    console.log('Admin user created/updated:', admin.username);
    console.log('Password: password123');
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
