const fs = require('fs');
const path = require('path');

// Configuration
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const backupsDir = path.join(__dirname, '..', 'backups');

console.log(`Source Database: ${dbPath}`);

// Ensure backup directory exists
if (!fs.existsSync(backupsDir)) {
    console.log(`Creating backup directory: ${backupsDir}`);
    fs.mkdirSync(backupsDir, { recursive: true });
}

// Generate filename with timestamp
const now = new Date();
const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
const backupFilename = `backup_${timestamp}.db`;
const destPath = path.join(backupsDir, backupFilename);

// Perform copy
try {
    if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, destPath);
        console.log(`✅ Database successfully backed up to:`);
        console.log(`   ${destPath}`);
    } else {
        console.error(`❌ Error: Database file not found at ${dbPath}`);
        process.exit(1);
    }
} catch (err) {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
}
