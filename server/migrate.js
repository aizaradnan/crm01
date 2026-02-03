// Migration script to update database schema
const { execSync } = require('child_process');
const path = require('path');

const nodePath = 'C:\\Program Files\\nodejs';
process.env.PATH = `${nodePath};${process.env.PATH}`;

console.log('Running Prisma db push...');
try {
    execSync('npx prisma db push --force-reset --accept-data-loss', {
        stdio: 'inherit',
        cwd: __dirname,
        env: { ...process.env, PATH: `${nodePath};${process.env.PATH}` }
    });
    console.log('Database schema updated successfully!');

    console.log('Generating Prisma client...');
    execSync('npx prisma generate', {
        stdio: 'inherit',
        cwd: __dirname,
        env: { ...process.env, PATH: `${nodePath};${process.env.PATH}` }
    });
    console.log('Prisma client generated!');
} catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
}
