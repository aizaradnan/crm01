import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, Eye, Undo2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

interface DailyRecord {
    id: number;
    date: string;
    totalSale: number;
    totalSaleGmv: number;
    directShopSale: number;
    gmvSaleLive: number; // Added for display
    gmvAdsSpend: number;
    gmvLiveAdsSpend: number;
    gmvProductAdsSpend: number;
    ttamSpendAds: number;
    totalAdsSpend: number;
    roiTotal: number;
    roiGmv: number;
    // Funnel Fields
    visitor?: number;
    customers?: number;
}

interface PreviewResult {
    selectedMonth: string;
    totalRowsInFile: number;
    validRows: number;
    invalidRows: number;
    existingRecordsToDelete: number;
    errors: { row: number; reason: string }[];
}

const MonthlyData = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    });
    const [records, setRecords] = useState<DailyRecord[]>([]);
    const [prevMonthRecords, setPrevMonthRecords] = useState<DailyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Import state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [, setImportResult] = useState<any>(null);
    const [undoAvailable, setUndoAvailable] = useState(false);
    const [undoLoading, setUndoLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    // Check user role
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setIsAdmin(payload.role === 'ADMIN');
            } catch {
                setIsAdmin(false);
            }
        }
    }, []);

    // Get previous month string
    const getPreviousMonth = (month: string): string => {
        const [year, m] = month.split('-').map(Number);
        const prevDate = new Date(year, m - 2, 1);
        return `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
    };

    // Fetch records for current and previous month
    const fetchRecords = async () => {
        setLoading(true);
        try {
            const prevMonth = getPreviousMonth(selectedMonth);
            const [currentRes, prevRes] = await Promise.all([
                api.get(`/records?month=${selectedMonth}`),
                api.get(`/records?month=${prevMonth}`)
            ]);
            setRecords(currentRes.data);
            setPrevMonthRecords(prevRes.data);
        } catch (err) {
            console.error('Failed to fetch records', err);
        }
        setLoading(false);
    };

    // Check undo availability
    const checkUndoStatus = async () => {
        if (!isAdmin) return;
        try {
            const res = await api.get('/import/undo-status');
            setUndoAvailable(res.data.available);
        } catch {
            setUndoAvailable(false);
        }
    };

    useEffect(() => {
        fetchRecords();
        if (isAdmin) checkUndoStatus();
    }, [selectedMonth, isAdmin]);

    // Sort records by date (newest first for display, but we need oldest first for calculations)
    const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Combine records for robust history lookups (Prev Month + Current Month)
    const allRecords = React.useMemo(() => {
        return [...prevMonthRecords, ...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [records, prevMonthRecords]);

    // Calculate rolling WEIGHTED average of ROI for past N days
    // Weighted ROI = Sum(GMV) / Sum(AdsSpend)
    const getRollingWeightedROI = (targetDate: string, n: number = 7): number => {
        const index = allRecords.findIndex(r => r.date === targetDate);
        if (index === -1) return 0;

        const start = Math.max(0, index - n);
        const subset = allRecords.slice(start, index); // strictly previous N days
        if (subset.length === 0) return 0;

        const totalGmv = subset.reduce((sum, r) => sum + r.totalSaleGmv, 0);
        const totalAds = subset.reduce((sum, r) => sum + r.totalAdsSpend, 0);

        return totalAds > 0 ? totalGmv / totalAds : 0;
    };

    // Get consecutive declining days count (Current vs Previous Day)
    const getConsecutiveDecline = (targetDate: string): number => {
        const index = allRecords.findIndex(r => r.date === targetDate);
        if (index <= 0) return 0;

        let count = 0;
        for (let i = index; i > 0; i--) {
            if (allRecords[i].roiGmv < allRecords[i - 1].roiGmv) {
                count++;
            } else {
                break;
            }
        }
        return count;
    };

    // Get per-row status
    const getRowStatus = (record: DailyRecord): { icon: string; status: string } => {
        const rollingAvg = getRollingWeightedROI(record.date);
        const consecutiveDecline = getConsecutiveDecline(record.date);
        const roiDeviation = rollingAvg > 0 ? ((record.roiGmv - rollingAvg) / rollingAvg) * 100 : 0;

        // Get previous record for spend/ROI comparison from FULL history
        const fullIndex = allRecords.findIndex(r => r.date === record.date);
        const prevRecord = fullIndex > 0 ? allRecords[fullIndex - 1] : null;

        const spendIncreased = prevRecord ? record.totalAdsSpend > prevRecord.totalAdsSpend : false;
        const roiDecreased = prevRecord ? record.roiGmv < prevRecord.roiGmv : false;

        // 🔴 RISK: 3+ consecutive decline AND >30% below avg, OR spend up + ROI down
        if ((consecutiveDecline >= 3 && roiDeviation < -30) || (spendIncreased && roiDecreased && roiDeviation < -20)) {
            return { icon: '🔴', status: 'Risk' };
        }

        // 🟡 WATCH: 2+ consecutive decline OR 20-30% below avg
        if (consecutiveDecline >= 2 || (roiDeviation < -20 && roiDeviation >= -30)) {
            return { icon: '🟡', status: 'Watch' };
        }

        // 🟢 STABLE: ROI within ±20% of rolling avg, no consecutive decline
        return { icon: '🟢', status: 'Stable' };
    };

    // Get per-row reason hints
    const getRowReasons = (record: DailyRecord): string[] => {
        const fullIndex = allRecords.findIndex(r => r.date === record.date);
        if (fullIndex <= 0) return [];

        const prevRecord = allRecords[fullIndex - 1];
        const hints: { priority: number; text: string }[] = [];

        // A. SPEND SPIKE: Ads up + ROI down
        if (record.totalAdsSpend > prevRecord.totalAdsSpend && record.roiGmv < prevRecord.roiGmv) {
            hints.push({ priority: 1, text: "Spend Spike" });
        }

        // B. LIVE DROP: GMV Live down + contribution % decreases
        const prevLiveContrib = prevRecord.totalSaleGmv > 0 ? (prevRecord.gmvLiveAdsSpend / prevRecord.totalSaleGmv) * 100 : 0;
        const currLiveContrib = record.totalSaleGmv > 0 ? (record.gmvLiveAdsSpend / record.totalSaleGmv) * 100 : 0;
        if (record.gmvLiveAdsSpend < prevRecord.gmvLiveAdsSpend && currLiveContrib < prevLiveContrib) {
            hints.push({ priority: 2, text: "Live Drop" });
        }

        // C. ADS EFFICIENCY DROP: Ads spend high + GMV return down
        if (record.gmvAdsSpend >= prevRecord.gmvAdsSpend && record.totalSaleGmv < prevRecord.totalSaleGmv) {
            hints.push({ priority: 3, text: "Ads Efficiency Drop" });
        }

        return hints.sort((a, b) => a.priority - b.priority).slice(0, 2).map(h => h.text);
    };

    // Create index map for quick lookup
    const recordIndexMap = new Map<number, number>();
    sortedRecords.forEach((r, i) => recordIndexMap.set(r.id, i));

    // Generate month options
    const monthOptions = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        monthOptions.push({ value, label });
    }

    // Download template
    const handleDownloadTemplate = async () => {
        try {
            const res = await api.get(`/import/template?month=${selectedMonth}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `import_template_${selectedMonth}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            setStatus({ type: 'error', message: 'Failed to download template' });
        }
    };

    // File selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewResult(null);
            setImportResult(null);
            setStatus(null);
        }
    };

    // Preview (Dry Run)
    const handlePreview = async () => {
        if (!selectedFile) return;

        setPreviewLoading(true);
        setPreviewResult(null);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('month', selectedMonth);

        try {
            const res = await api.post('/import/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setPreviewResult(res.data.preview);
        } catch (err: any) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to preview file' });
        }
        setPreviewLoading(false);
    };

    // Confirm Import
    const handleConfirmImport = async () => {
        if (!selectedFile || !previewResult) return;

        if (!window.confirm(
            `⚠️ WARNING: This will DELETE ${previewResult.existingRecordsToDelete} existing records and REPLACE them with ${previewResult.validRows} new records for ${selectedMonth}.\n\nThis action cannot be easily undone. Continue?`
        )) return;

        setImportLoading(true);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('month', selectedMonth);

        try {
            const res = await api.post('/import/confirm', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportResult(res.data.result);
            setStatus({ type: 'success', message: `Successfully imported ${res.data.result.recordsImported} records` });
            setSelectedFile(null);
            setPreviewResult(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchRecords();
            checkUndoStatus();
        } catch (err: any) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to import records' });
        }
        setImportLoading(false);
    };

    // Undo Import
    const handleUndo = async () => {
        if (!window.confirm('Are you sure you want to undo the last import? This will restore the previous data.')) return;

        setUndoLoading(true);
        try {
            const res = await api.post('/import/undo');
            setStatus({ type: 'success', message: `Import reverted: ${res.data.result.recordsRestored} records restored` });
            fetchRecords();
            checkUndoStatus();
        } catch (err: any) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to undo import' });
        }
        setUndoLoading(false);
    };

    // Format date for display
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    };

    // Handle row click (Admin only)
    const handleRowClick = (record: DailyRecord) => {
        if (isAdmin) {
            navigate('/entry', { state: { date: record.date } });
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                    Monthly Data
                </h2>

                {/* Month Selector */}
                <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:border-black outline-none shadow-sm"
                >
                    {monthOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Status Message */}
            {status && (
                <div className={`p-4 rounded-lg border flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
                    status.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
                        'bg-blue-50 text-blue-800 border-blue-200'
                    }`}>
                    {status.type === 'success' ? <CheckCircle size={20} /> :
                        status.type === 'error' ? <XCircle size={20} /> :
                            <AlertTriangle size={20} />}
                    {status.message}
                </div>
            )}

            {/* Admin: Bulk Import Section */}
            {isAdmin && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">Bulk Import</h3>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition-colors border border-gray-200"
                        >
                            <Download size={18} />
                            Download Template
                        </button>

                        <div className="flex items-center gap-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="file-upload"
                            />
                            <label
                                htmlFor="file-upload"
                                className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg cursor-pointer transition-colors shadow-sm"
                            >
                                <Upload size={18} />
                                {selectedFile ? selectedFile.name : 'Select File'}
                            </label>
                        </div>

                        <button
                            onClick={handlePreview}
                            disabled={!selectedFile || previewLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Eye size={18} />
                            {previewLoading ? 'Processing...' : 'Preview (Dry Run)'}
                        </button>

                        {undoAvailable && (
                            <button
                                onClick={handleUndo}
                                disabled={undoLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                            >
                                <Undo2 size={18} />
                                {undoLoading ? 'Undoing...' : 'Undo Last Import'}
                            </button>
                        )}
                    </div>

                    {/* Preview Results */}
                    {previewResult && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
                            <h4 className="font-bold text-lg text-gray-900">Preview Results</h4>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
                                    <p className="text-2xl font-bold text-blue-600">{previewResult.totalRowsInFile}</p>
                                    <p className="text-sm text-gray-500">Rows in File</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
                                    <p className="text-2xl font-bold text-green-600">{previewResult.validRows}</p>
                                    <p className="text-sm text-gray-500">Valid Rows</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
                                    <p className="text-2xl font-bold text-red-600">{previewResult.invalidRows}</p>
                                    <p className="text-sm text-gray-500">Invalid Rows</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
                                    <p className="text-2xl font-bold text-yellow-600">{previewResult.existingRecordsToDelete}</p>
                                    <p className="text-sm text-gray-500">To Delete</p>
                                </div>
                            </div>

                            {/* Errors List */}
                            {previewResult.errors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="font-semibold text-red-700 mb-2">Validation Errors:</p>
                                    <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                                        {previewResult.errors.map((err, i) => (
                                            <p key={i} className="text-red-600">
                                                Row {err.row}: {err.reason}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Warning and Confirm Button */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-yellow-800 flex items-center gap-2">
                                    <AlertTriangle size={18} />
                                    This action will DELETE and REPLACE all existing data for {previewResult.selectedMonth}.
                                </p>
                            </div>

                            <button
                                onClick={handleConfirmImport}
                                disabled={importLoading || previewResult.validRows === 0}
                                className="w-full py-3 bg-black hover:bg-gray-800 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                {importLoading ? 'Importing...' : `Confirm Import (${previewResult.validRows} records)`}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">Date</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">Total Sale</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">Total Sale GMV</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">GMV Product</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">GMV Live</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">Total Ads Spend</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">Visitor</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">Cust.</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">CR %</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">AOV</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">CAC</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">ROI (Total)</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">ROI (GMV)</th>
                                <th className="text-center px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">Status</th>
                                <th className="text-left px-4 py-3 text-gray-500 font-semibold text-sm uppercase tracking-wider">Reason</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="text-center py-8 text-gray-500">Loading...</td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="text-center py-8 text-gray-500">No records for this month</td>
                                </tr>
                            ) : (
                                sortedRecords.map((record) => {
                                    const rowStatus = getRowStatus(record);
                                    const rowReasons = getRowReasons(record);
                                    return (
                                        <tr
                                            key={record.id}
                                            onClick={() => handleRowClick(record)}
                                            className={`hover:bg-gray-50 transition-colors ${isAdmin ? 'cursor-pointer' : ''}`}
                                        >
                                            <td className="px-4 py-3 text-gray-900 font-medium">{formatDate(record.date)}</td>
                                            <td className="px-4 py-3 text-right text-gray-700">RM {record.totalSale.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-gray-700">RM {record.totalSaleGmv.toLocaleString()}</td>

                                            {/* New Columns */}
                                            <td className="px-4 py-3 text-right text-gray-700">RM {(record.totalSaleGmv - record.gmvSaleLive).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-gray-700">RM {record.gmvSaleLive.toLocaleString()}</td>

                                            <td className="px-4 py-3 text-right text-gray-700">RM {record.totalAdsSpend.toLocaleString()}</td>

                                            {/* Funnel Metrics */}
                                            <td className="px-4 py-3 text-right text-gray-600">{record.visitor?.toLocaleString() || '-'}</td>
                                            <td className="px-4 py-3 text-right text-gray-600">{record.customers?.toLocaleString() || '-'}</td>
                                            <td className="px-4 py-3 text-right text-gray-900 font-medium">
                                                {record.visitor && record.customers ? ((record.customers / record.visitor) * 100).toFixed(2) + '%' : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-900">
                                                {record.customers && record.customers > 0 ? 'RM' + (record.totalSale / record.customers).toFixed(2) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-red-600 font-medium">
                                                {record.customers && record.customers > 0 ? 'RM' + (record.totalAdsSpend / record.customers).toFixed(2) : '-'}
                                            </td>

                                            <td className="px-4 py-3 text-right font-bold text-blue-600 bg-blue-50/50 rounded">{record.roiTotal.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-purple-600 bg-purple-50/50 rounded">{record.roiGmv.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center text-lg">{rowStatus.icon}</td>
                                            <td className="px-4 py-3 text-left text-sm text-gray-500">
                                                {rowStatus.status !== 'Stable' && rowReasons.length > 0
                                                    ? rowReasons.join(', ')
                                                    : ''}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                {records.length > 0 && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500 flex justify-between items-center">
                        <span>Showing {records.length} records for {monthOptions.find(m => m.value === selectedMonth)?.label}</span>
                        {isAdmin && <span className="text-gray-400 italic">Click row to edit</span>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MonthlyData;
