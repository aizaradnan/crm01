// Script to regenerate Prisma client and check database
const { execSync } = require('child_process');
const path = require('path');

const nodePath = 'C:\\Program Files\\nodejs';
process.env.PATH = `${nodePath};${process.env.PATH}`;

console.log('Regenerating Prisma client...');
try {
    execSync('npx prisma generate', {
        stdio: 'inherit',
        cwd: __dirname,
        env: { ...process.env, PATH: `${nodePath};${process.env.PATH}` }
    });
    console.log('Prisma client regenerated successfully!');
} catch (err) {
    console.error('Failed:', err.message);
}
