import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import multer from 'multer';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

app.use(cors());
app.use(express.json());

// --- Types & Middleware ---

const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const requireAdmin = (req: any, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'ADMIN') return res.sendStatus(403);
    next();
};

// Multer config for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Backup storage for undo functionality
let lastImportBackup: {
    month: string;
    records: any[];
    importedIds: number[];
    timestamp: Date;
} | null = null;

// --- Formulas ---
const calculateMetrics = (record: any) => {
    // Sales calculations
    const gmvSaleProduct = record.totalSaleGmv - record.gmvSaleLive;
    const directShopSale = record.totalSale - record.totalSaleGmv;

    // Ads calculations (NEW STRUCTURE)
    const gmvProductAdsSpend = record.gmvAdsSpend - record.gmvLiveAdsSpend;
    const totalAdsSpend = record.gmvAdsSpend + record.ttamSpendAds;
    const cpm = record.ttamImpressions > 0 ? (record.ttamSpendAds / record.ttamImpressions) * 1000 : 0;

    // ROI calculations
    const roiTotal = totalAdsSpend > 0 ? record.totalSale / totalAdsSpend : 0;
    const roiGmv = totalAdsSpend > 0 ? record.totalSaleGmv / totalAdsSpend : 0;

    return {
        ...record,
        gmvSaleProduct,
        directShopSale,
        gmvProductAdsSpend,
        totalAdsSpend,
        cpm,
        roiTotal,
        roiGmv
    };
};

// --- Validation Schemas ---
const recordSchema = z.object({
    date: z.string().or(z.date()),
    totalSale: z.number().min(0),
    totalSaleGmv: z.number().min(0),
    gmvSaleLive: z.number().min(0),
    gmvAdsSpend: z.number().min(0),
    gmvLiveAdsSpend: z.number().min(0),
    ttamSpendAds: z.number().min(0, "TTAM Spend must be positive"),
    ttamImpressions: z.number().min(0, "TTAM Impressions must be positive"),
    visitor: z.number().min(0, "Visitor must be positive").default(0),
    customers: z.number().min(0, "Customers must be positive").default(0)
}).refine(data => data.totalSale >= data.totalSaleGmv, {
    message: "Total Sale must be >= Total Sale GMV",
    path: ["totalSale"]
}).refine(data => data.totalSaleGmv >= data.gmvSaleLive, {
    message: "Total Sale GMV must be >= GMV Sale Live",
    path: ["totalSaleGmv"]
}).refine(data => data.gmvAdsSpend >= data.gmvLiveAdsSpend, {
    message: "GMV Ads Spend must be >= GMV Live Ads Spend",
    path: ["gmvAdsSpend"]
});

// --- Routes ---

// Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// Get Records (Client & Admin)
app.get('/api/records', authenticateToken, async (req: any, res: Response) => {
    const { month, startDate, endDate } = req.query; // Format: YYYY-MM OR startDate/endDate

    let where: any = {};

    if (startDate && endDate) {
        where = {
            date: {
                gte: new Date(startDate as string),
                lt: new Date(endDate as string) // Client already sends inclusive end date (day + 1)
            }
        };
    } else if (typeof month === 'string') {
        const start = new Date(`${month}-01`);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);

        where = {
            date: {
                gte: start,
                lt: end
            }
        }
    }

    const records = await prisma.dailyRecord.findMany({
        where,
        orderBy: { date: 'desc' }
    });

    const enrichedRecords = records.map(calculateMetrics);
    res.json(enrichedRecords);
});

// Funnel Metrics (Unified)
app.get('/api/funnel-metrics', authenticateToken, async (req: any, res: Response) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);

    // Calculate previous period
    // diff time
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);

    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (diffDays > 0 ? diffDays - 1 : 0)); // diffDays includes start day, so subtract 1 less? 
    // Wait, let's verify logic:
    // User said: rangeDays = diff + 1. 
    // If start=1st, end=7th. diff is 6 days. rangeDays = 7.
    // prevEnd = 31st (startDate - 1). 
    // prevStart = prevEnd - rangeDays + 1 = 31 - 7 + 1 = 25th.
    // 25th to 31st is 7 days. Correct.

    // My previous logic: diffDays based on time might be slightly off due to hours. 
    // Let's use user formula strictly.
    const oneDay = 1000 * 60 * 60 * 24;
    // Reset hours for diff calculation to avoid DST/time issues
    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(0, 0, 0, 0);
    const rangeDays = Math.round((e.getTime() - s.getTime()) / oneDay) + 1;

    // prevEnd
    const pEnd = new Date(s);
    pEnd.setDate(pEnd.getDate() - 1);
    pEnd.setHours(23, 59, 59, 999);

    // prevStart
    const pStart = new Date(pEnd);
    pStart.setDate(pStart.getDate() - rangeDays + 1);
    pStart.setHours(0, 0, 0, 0);

    const getAggregates = async (gte: Date, lte: Date) => {
        const aggregates = await prisma.dailyRecord.aggregate({
            where: {
                date: { gte, lte }
            },
            _sum: {
                visitor: true,
                customers: true,
                totalSale: true,
                gmvAdsSpend: true,
                ttamSpendAds: true
            }
        });

        const visitor = aggregates._sum.visitor || 0;
        const customers = aggregates._sum.customers || 0;
        const revenue = aggregates._sum.totalSale || 0;
        const gmvAdsSpend = aggregates._sum.gmvAdsSpend || 0;
        const ttamSpendAds = aggregates._sum.ttamSpendAds || 0;
        const ads = gmvAdsSpend + ttamSpendAds;

        return { visitor, customers, revenue, ads };
    };

    const current = await getAggregates(start, end);
    const previous = await getAggregates(pStart, pEnd);

    res.json({
        current,
        previous
    });
});

// Save Record (Admin Only) - Upsert Logic
app.post('/api/records', authenticateToken, requireAdmin, async (req: any, res: Response) => {
    try {
        const validatedData = recordSchema.parse(req.body);
        const date = new Date(validatedData.date);

        // Normalize date to midnight UTC for consistent comparison
        date.setUTCHours(0, 0, 0, 0);

        // Check if record exists for this date
        const existingRecord = await prisma.dailyRecord.findFirst({
            where: {
                date: {
                    gte: date,
                    lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
                }
            }
        });

        let record;
        let mode: 'create' | 'update';

        if (existingRecord) {
            // UPDATE existing record
            record = await prisma.dailyRecord.update({
                where: { id: existingRecord.id },
                data: {
                    totalSale: validatedData.totalSale,
                    totalSaleGmv: validatedData.totalSaleGmv,
                    gmvSaleLive: validatedData.gmvSaleLive,
                    gmvAdsSpend: validatedData.gmvAdsSpend,
                    gmvLiveAdsSpend: validatedData.gmvLiveAdsSpend,
                    ttamSpendAds: validatedData.ttamSpendAds,
                    ttamImpressions: validatedData.ttamImpressions,
                    visitor: validatedData.visitor,
                    customers: validatedData.customers
                }
            });
            mode = 'update';
        } else {
            // CREATE new record
            record = await prisma.dailyRecord.create({
                data: {
                    date,
                    totalSale: validatedData.totalSale,
                    totalSaleGmv: validatedData.totalSaleGmv,
                    gmvSaleLive: validatedData.gmvSaleLive,
                    gmvAdsSpend: validatedData.gmvAdsSpend,
                    gmvLiveAdsSpend: validatedData.gmvLiveAdsSpend,
                    ttamSpendAds: validatedData.ttamSpendAds,
                    ttamImpressions: validatedData.ttamImpressions,
                    visitor: validatedData.visitor,
                    customers: validatedData.customers
                }
            });
            mode = 'create';
        }

        res.json({
            status: 'success',
            mode,
            data: calculateMetrics(record)
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                code: 'validation_error',
                message: 'Invalid date or values',
                errors: (error as any).errors
            });
        }
        console.error(error);
        res.status(500).json({
            status: 'error',
            code: 'server_error',
            message: 'Unable to save record'
        });
    }
});

// Update Record by ID (Admin Only) - Keep for direct ID updates
app.put('/api/records/:id', authenticateToken, requireAdmin, async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                status: 'error',
                code: 'validation_error',
                message: 'Invalid record ID'
            });
        }

        const validatedData = recordSchema.parse(req.body);

        const record = await prisma.dailyRecord.update({
            where: { id },
            data: {
                totalSale: validatedData.totalSale,
                totalSaleGmv: validatedData.totalSaleGmv,
                gmvSaleLive: validatedData.gmvSaleLive,
                gmvAdsSpend: validatedData.gmvAdsSpend,
                gmvLiveAdsSpend: validatedData.gmvLiveAdsSpend,
                ttamSpendAds: validatedData.ttamSpendAds,
                ttamImpressions: validatedData.ttamImpressions,
                visitor: validatedData.visitor,
                customers: validatedData.customers
            }
        });

        res.json({
            status: 'success',
            mode: 'update',
            data: calculateMetrics(record)
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                code: 'validation_error',
                message: 'Invalid date or values',
                errors: (error as any).errors
            });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({
                status: 'error',
                code: 'not_found',
                message: 'Record not found'
            });
        }
        console.error(error);
        res.status(500).json({
            status: 'error',
            code: 'server_error',
            message: 'Unable to save record'
        });
    }
});

// Summary Endpoint for Page 1
app.get('/api/summary', authenticateToken, async (req: any, res: Response) => {

    const { start, end } = req.query;
    if (!start || !end) {
        // Default to current month if no range? Or return error
        // For now return error
        return res.status(400).json({ error: "Start and End date required" });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);
    endDate.setDate(endDate.getDate() + 1);

    const records = await prisma.dailyRecord.findMany({
        where: {
            date: {
                gte: startDate,
                lt: endDate
            }
        }
    });

    // Aggregate
    let totalSale = 0;
    let totalAdsSpend = 0;
    let totalSaleGmv = 0;
    let totalLiveGmv = 0;
    let totalDirectShop = 0;

    records.forEach((r: any) => { // Cast to avoid inference issues
        const m = calculateMetrics(r);
        totalSale += m.totalSale;
        totalAdsSpend += m.totalAdsSpend;
        totalSaleGmv += m.totalSaleGmv;
        totalLiveGmv += m.gmvSaleLive;
        totalDirectShop += m.directShopSale;
    });

    const roiTotal = totalAdsSpend > 0 ? totalSale / totalAdsSpend : 0;
    const roiGmv = totalAdsSpend > 0 ? totalSaleGmv / totalAdsSpend : 0;

    res.json({
        totalSale,
        totalAdsSpend,
        roiTotal,
        roiGmv,
        totalSaleGmv,
        totalLiveGmv,
        totalDirectShop,
        records: records.map(calculateMetrics)
    });
});

// ================================
// BULK IMPORT ENDPOINTS
// ================================

// Helper: Parse Excel date (DD/MM/YYYY) to ISO date
const parseExcelDate = (value: any): Date | null => {
    if (!value) return null;

    // If it's an Excel serial number
    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
            // Use Date.UTC to ensure midnight UTC
            return new Date(Date.UTC(date.y, date.m - 1, date.d));
        }
    }

    // If it's a string like DD/MM/YYYY
    if (typeof value === 'string') {
        const parts = value.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const year = parseInt(parts[2]);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                // Use Date.UTC to ensure midnight UTC
                return new Date(Date.UTC(year, month, day));
            }
        }
    }

    return null;
};

// Download Excel Template
app.get('/api/import/template', authenticateToken, requireAdmin, (req: any, res: Response) => {
    const month = req.query.month as string; // Format: YYYY-MM

    // Create template data - NEW ADS COLUMN STRUCTURE
    // Create template data - MATCHING PAGE 3 INPUT ORDER
    const templateData = [
        ['Date (DD/MM/YYYY)', 'Total Sale', 'Total Sale GMV', 'GMV Sale Live', 'GMV Live Ads Spend', 'GMV Ads Spend', 'TTAM Spend', 'TTAM Impressions', 'Visitor', 'Customers'],
        ['01/01/2026', 10000, 8000, 5000, 600, 1000, 500, 50000, 1000, 50],
        ['02/01/2026', 12000, 9000, 6000, 700, 1200, 600, 60000, 1200, 60],
    ];

    // If month provided, generate dates for that month
    if (month) {
        const [year, monthNum] = month.split('-').map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        templateData.length = 1; // Keep header only

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${day.toString().padStart(2, '0')}/${monthNum.toString().padStart(2, '0')}/${year}`;
            templateData.push([dateStr, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        }
    }

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Records');

    // Set column widths
    ws['!cols'] = [
        { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 16 },
        { wch: 10 }, { wch: 10 }
    ];

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="import_template_${month || 'sample'}.xlsx"`);
    res.send(buffer);
});

// Preview Import (Dry Run)
app.post('/api/import/preview', authenticateToken, requireAdmin, upload.single('file'), async (req: any, res: Response) => {
    try {
        const { month } = req.body; // Format: YYYY-MM

        if (!month || !req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'Month and file are required'
            });
        }

        const [targetYear, targetMonth] = month.split('-').map(Number);

        // Parse Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Skip header row
        const dataRows = rawData.slice(1).filter(row => row.length > 0 && row[0]);

        const validRows: any[] = [];
        const invalidRows: { row: number; reason: string }[] = [];

        dataRows.forEach((row, index) => {
            const rowNum = index + 2; // Excel row number (1-indexed + header)

            // Parse date
            const date = parseExcelDate(row[0]);
            if (!date) {
                invalidRows.push({ row: rowNum, reason: 'Invalid date format. Use DD/MM/YYYY' });
                return;
            }

            // Check month match
            if (date.getMonth() + 1 !== targetMonth || date.getFullYear() !== targetYear) {
                invalidRows.push({ row: rowNum, reason: `Date does not match selected month (${month})` });
                return;
            }

            // Parse numeric values - NEW COLUMN STRUCTURE
            // Parse numeric values - UPDATED COLUMN STRUCTURE
            const totalSale = parseFloat(row[1]) || 0;
            const totalSaleGmv = parseFloat(row[2]) || 0;
            const gmvSaleLive = parseFloat(row[3]) || 0;
            const gmvLiveAdsSpend = parseFloat(row[4]) || 0; // Swap: Live Ads is now col 4
            const gmvAdsSpend = parseFloat(row[5]) || 0;     // Swap: Ads Spend is now col 5
            const ttamSpendAds = parseFloat(row[6]) || 0;
            const ttamImpressions = parseInt(row[7]) || 0;
            const visitor = parseInt(row[8]) || 0;
            const customers = parseInt(row[9]) || 0;

            // Validate business rules
            if (totalSale < totalSaleGmv) {
                invalidRows.push({ row: rowNum, reason: 'Total Sale must be >= Total Sale GMV' });
                return;
            }
            if (totalSaleGmv < gmvSaleLive) {
                invalidRows.push({ row: rowNum, reason: 'Total Sale GMV must be >= GMV Sale Live' });
                return;
            }
            if (gmvAdsSpend < gmvLiveAdsSpend) {
                invalidRows.push({ row: rowNum, reason: 'GMV Ads Spend must be >= GMV Live Ads Spend' });
                return;
            }
            if (customers > visitor) {
                invalidRows.push({ row: rowNum, reason: 'Customers cannot be > Visitor' });
                return;
            }

            validRows.push({
                date,
                totalSale,
                totalSaleGmv,
                gmvSaleLive,
                gmvAdsSpend,
                gmvLiveAdsSpend,
                ttamSpendAds,
                ttamImpressions,
                visitor,
                customers
            });
        });

        // Check for duplicate dates in valid rows
        const dateSet = new Set<string>();
        validRows.forEach((row, index) => {
            const dateKey = row.date.toISOString().split('T')[0];
            if (dateSet.has(dateKey)) {
                invalidRows.push({ row: index + 2, reason: 'Duplicate date in file' });
            } else {
                dateSet.add(dateKey);
            }
        });

        // Get existing records count for this month
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 1);
        const existingCount = await prisma.dailyRecord.count({
            where: {
                date: { gte: startDate, lt: endDate }
            }
        });

        res.json({
            status: 'success',
            preview: {
                selectedMonth: month,
                totalRowsInFile: dataRows.length,
                validRows: validRows.length,
                invalidRows: invalidRows.length,
                existingRecordsToDelete: existingCount,
                errors: invalidRows
            }
        });
    } catch (error: any) {
        console.error('Preview error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process file'
        });
    }
});

// Confirm Import (Execute)
app.post('/api/import/confirm', authenticateToken, requireAdmin, upload.single('file'), async (req: any, res: Response) => {
    try {
        const { month } = req.body;

        if (!month || !req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'Month and file are required'
            });
        }

        const [targetYear, targetMonth] = month.split('-').map(Number);

        // Parse Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        const dataRows = rawData.slice(1).filter(row => row.length > 0 && row[0]);

        // Parse and validate rows - NEW COLUMN STRUCTURE
        const validRows: any[] = [];
        dataRows.forEach((row) => {
            const date = parseExcelDate(row[0]);
            if (!date) return;
            if (date.getMonth() + 1 !== targetMonth || date.getFullYear() !== targetYear) return;

            const totalSale = parseFloat(row[1]) || 0;
            const totalSaleGmv = parseFloat(row[2]) || 0;
            const gmvSaleLive = parseFloat(row[3]) || 0;
            const gmvLiveAdsSpend = parseFloat(row[4]) || 0;
            const gmvAdsSpend = parseFloat(row[5]) || 0;
            const ttamSpendAds = parseFloat(row[6]) || 0;
            const ttamImpressions = parseInt(row[7]) || 0;
            const visitor = parseInt(row[8]) || 0;
            const customers = parseInt(row[9]) || 0;

            if (totalSale >= totalSaleGmv && totalSaleGmv >= gmvSaleLive && gmvAdsSpend >= gmvLiveAdsSpend) {
                validRows.push({
                    date,
                    totalSale: totalSale,
                    totalSaleGmv: totalSaleGmv,
                    gmvSaleLive: gmvSaleLive,
                    gmvAdsSpend: gmvAdsSpend,
                    gmvLiveAdsSpend: gmvLiveAdsSpend,
                    ttamSpendAds: ttamSpendAds,
                    ttamImpressions: ttamImpressions,
                    visitor: visitor,
                    customers: customers
                });
            }
        });

        // STEP 1: Backup existing records
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 1);

        const existingRecords = await prisma.dailyRecord.findMany({
            where: { date: { gte: startDate, lt: endDate } }
        });

        // STEP 2: Delete existing records
        await prisma.dailyRecord.deleteMany({
            where: { date: { gte: startDate, lt: endDate } }
        });

        // STEP 3: Insert new records
        const importedIds: number[] = [];
        for (const row of validRows) {
            const record = await prisma.dailyRecord.create({
                data: {
                    date: row.date,
                    totalSale: row.totalSale,
                    totalSaleGmv: row.totalSaleGmv,
                    gmvSaleLive: row.gmvSaleLive,
                    gmvAdsSpend: row.gmvAdsSpend,
                    gmvLiveAdsSpend: row.gmvLiveAdsSpend,
                    ttamSpendAds: row.ttamSpendAds,
                    ttamImpressions: row.ttamImpressions,
                    visitor: row.visitor,
                    customers: row.customers
                }
            });
            importedIds.push(record.id);
        }

        // STEP 4: Store backup for undo
        lastImportBackup = {
            month,
            records: existingRecords,
            importedIds,
            timestamp: new Date()
        };

        res.json({
            status: 'success',
            mode: 'import',
            result: {
                month,
                recordsDeleted: existingRecords.length,
                recordsImported: importedIds.length,
                skipped: dataRows.length - validRows.length
            }
        });
    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to import records'
        });
    }
});

// Undo Last Import
app.post('/api/import/undo', authenticateToken, requireAdmin, async (req: any, res: Response) => {
    try {
        if (!lastImportBackup) {
            return res.status(400).json({
                status: 'error',
                message: 'No import to undo. Undo is only available for the most recent import.'
            });
        }

        // STEP 1: Delete imported records
        await prisma.dailyRecord.deleteMany({
            where: { id: { in: lastImportBackup.importedIds } }
        });

        // STEP 2: Restore backup records
        for (const record of lastImportBackup.records) {
            await prisma.dailyRecord.create({
                data: {
                    date: record.date,
                    totalSale: record.totalSale,
                    totalSaleGmv: record.totalSaleGmv,
                    gmvSaleLive: record.gmvSaleLive,
                    gmvAdsSpend: record.gmvAdsSpend,
                    gmvLiveAdsSpend: record.gmvLiveAdsSpend,
                    ttamSpendAds: record.ttamSpendAds,
                    ttamImpressions: record.ttamImpressions
                }
            });
        }

        const result = {
            month: lastImportBackup.month,
            recordsRestored: lastImportBackup.records.length,
            recordsRemoved: lastImportBackup.importedIds.length
        };

        // Clear backup after undo
        lastImportBackup = null;

        res.json({
            status: 'success',
            mode: 'undo',
            result
        });
    } catch (error: any) {
        console.error('Undo error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to undo import'
        });
    }
});

// Check if undo is available
// --- Analysis Reports ---

// Save a report (support versioning)
app.post('/api/reports', authenticateToken, requireAdmin, async (req: any, res: Response) => {
    try {
        const { clientName, startDate, endDate, saleAnalysis, saleRecommendation, prodAnalysis, prodRecommendation, liveAnalysis, liveRecommendation, summaryContent, version } = req.body;

        const report = await prisma.analysisReport.create({
            data: {
                clientName,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                saleAnalysis,
                saleRecommendation,
                prodAnalysis,
                prodRecommendation,
                liveAnalysis,
                liveRecommendation,
                summaryContent,
                version: version || 1
            }
        });

        res.json({
            status: 'success',
            report
        });
    } catch (error: any) {
        console.error('Save report error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to save report'
        });
    }
});

// Check if a specific version of a report exists for a date range
app.get('/api/reports/check', authenticateToken, async (req: any, res: Response) => {
    try {
        const { startDate, endDate, version } = req.query;
        const report = await prisma.analysisReport.findFirst({
            where: {
                startDate: new Date(startDate as string),
                endDate: new Date(endDate as string),
                version: parseInt(version as string) || 1
            }
        });
        res.json({ exists: !!report, report });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: 'Check failed' });
    }
});

// Get report history
app.get('/api/reports', authenticateToken, async (req: any, res: Response) => {
    try {
        const reports = await prisma.analysisReport.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(reports);
    } catch (error: any) {
        console.error('Get reports error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch report history'
        });
    }
});

app.get('/api/import/undo-status', authenticateToken, requireAdmin, (req: any, res: Response) => {
    res.json({
        available: !!lastImportBackup,
        month: lastImportBackup?.month || null,
        timestamp: lastImportBackup?.timestamp || null
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
