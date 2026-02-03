import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../lib/api';
import DateRangePicker from '../components/DateRangePicker';
import { FileText, TrendingUp, TrendingDown, Target, Zap, AlertCircle, CheckCircle2, Info, Edit, Send, Save, X, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface SummaryData {
    totalSale: number;
    totalAdsSpend: number;
    roiTotal: number;
    roiGmv: number;
    totalSaleGmv: number;
    totalLiveGmv: number;
    totalDirectShop: number;
    records: any[];
    // Funnel Metrics
    visitor?: number;
    customers?: number;
}

const AutoAnalysis = () => {
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return [start, end];
    });

    const [currentData, setCurrentData] = useState<SummaryData | null>(null);
    const [comparisonData, setComparisonData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);

    // --- Edit & Publish State ---
    const [editedContent, setEditedContent] = useState<any>({});
    const [editStates, setEditStates] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const [currentVersion, setCurrentVersion] = useState(1);

    // To prevent infinite auto-publish loops
    const lastPublishedRange = useRef<string>("");

    const fetchData = async () => {
        const [start, end] = dateRange;
        if (!start || !end) return;

        setLoading(true);
        try {
            const toStr = (d: Date) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            const startStr = toStr(start);
            const endStr = toStr(end);

            const duration = end.getTime() - start.getTime();
            const compEnd = new Date(start.getTime() - 86400000);
            const compStart = new Date(compEnd.getTime() - duration);

            const [cRes, pRes] = await Promise.all([
                api.get(`/summary?start=${startStr}&end=${endStr}`),
                api.get(`/summary?start=${toStr(compStart)}&end=${toStr(compEnd)}`)
            ]);

            setCurrentData(cRes.data);
            setComparisonData(pRes.data);

            // Reset edit states on date change
            setEditedContent({});
            setEditStates({});
            setCurrentVersion(1);
        } catch (err) {
            console.error('Fetch failed', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const getChange = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
    };

    // --- AMZ DIAGNOSIS ENGINE ---
    const report = useMemo(() => {
        if (!currentData || !comparisonData) return null;

        const c = currentData;
        const p = comparisonData;

        const saleChange = getChange(c.totalSale, p.totalSale);
        const roiChange = getChange(c.roiTotal, p.roiTotal);

        // --- FUNNEL METRICS CALCULATION ---
        const calcFunnel = (data: any) => {
            const vis = data.visitor || (data.records ? data.records.reduce((acc: number, r: any) => acc + (r.visitor || 0), 0) : 0);
            const cust = data.customers || (data.records ? data.records.reduce((acc: number, r: any) => acc + (r.customers || 0), 0) : 0);
            const sales = data.totalSale || 0;
            const spend = data.totalAdsSpend || 0;

            return {
                visitor: vis,
                customers: cust,
                cr: vis > 0 ? (cust / vis) * 100 : 0,
                aov: cust > 0 ? sales / cust : 0,
                cac: cust > 0 ? spend / cust : 0,
                rpv: vis > 0 ? sales / vis : 0
            };
        };

        const cFunnel = calcFunnel(c);
        const pFunnel = calcFunnel(p);

        const crChange = getChange(cFunnel.cr, pFunnel.cr);
        const aovChange = getChange(cFunnel.aov, pFunnel.aov);
        const visChange = getChange(cFunnel.visitor, pFunnel.visitor);

        let saleComment = "";
        let saleAction = "";

        // DIAGNOSIS ENGINE V2 (FUNNEL AWARE)
        if (saleChange < 0) {
            // Priority Diagnosis
            if (visChange < -10) {
                saleComment = "ALERT: Isu Trafik. Penurunan jualan berpunca dari kejatuhan trafik (Visitor) yang ketara. Funnel tersumbat di peringkat Awareness.";
                saleAction = "Tingkatkan bajet 'Traffic Awareness' atau hasilkan video 'Hook' baru untuk menarik trafik baru ke kedai.";
            } else if (crChange < -10) {
                saleComment = "ALERT: Isu Conversion. Trafik masuk tetapi tidak membeli (CR Drop). Tawaran (Offer) atau Landing Page video mungkin tidak lagi relevan.";
                saleAction = "Semak semula Offer, tambah Urgency (Limited Time Deal), atau perbaiki Product Card / Anchor Link dalam video.";
            } else if (aovChange < -10) {
                saleComment = "ALERT: Isu Nilai Jualan. Pelanggan membeli, tetapi nilai bakul (AOV) semakin mengecil. Kita kehilangan margin keuntungan.";
                saleAction = "Perkenalkan strategi 'Bundle Deal' atau 'Add-on Deal' untuk menaikkan semula nilai setiap pesanan.";
            } else if (roiChange < 0) {
                saleComment = "Penurunan ROI semasa jualan menurun menunjukkan Ads Efficiency semakin lemah. Kos untuk dapatkan pelanggan (CAC) semakin mahal.";
                saleAction = "Pause ads yang underperforming (CAC tinggi). Fokus bajet pada kempen yang mempunyai 'Lowest Cost' per result.";
            } else {
                saleComment = "Penurunan jualan keseluruhan. Perlu audit menyeluruh dari trafik ke conversion.";
                saleAction = "Lakukan audit penuh funnel.";
            }
        } else {
            if (roiChange > 0) {
                saleComment = "Prestasi Cemerlang. Jualan dan ROI meningkat serentak. Funnel berfungsi dengan baik dari Trafik -> Conversion -> Profit.";
                saleAction = "Fasa Scaling. Naikkan bajet sebanyak 20% pada kempen yang mempunyai CR & ROI tertinggi.";
            } else {
                // Sales UP, ROI DOWN (Scaling pain)
                saleComment = "Jualan meningkat TETAPI ROI menurun. Kita 'membeli sales' dengan kos yang mahal (CAC meningkat).";
                saleAction = "Kawal kenaikan CAC. Perbaiki kreatif iklan untuk turunkan kos klik (CPC) dan naikkan relevansi.";
            }
        }

        const prodCurr = (c.totalSaleGmv || 0) - (c.totalLiveGmv || 0);
        const prodPrev = (p.totalSaleGmv || 0) - (p.totalLiveGmv || 0);
        const prodChange = getChange(prodCurr, prodPrev);
        let prodComment = "";
        let prodAction = "";
        if (prodChange < -10) {
            prodComment = "Penurunan GMV Produk menunjukkan jangkauan (reach) video organik dan berbayar semakin lemah. Tiada 'Content Wave' yang menyokong jualan harian.";
            prodAction = "Terapkan formula VSP (Reach + VV refill). Fokus pada penghasilan video 'Awareness' dan 'Consideration' untuk memenuhi semula funnel jualan sebelum fokus hard-sell.";
        } else {
            prodComment = "Prestasi jualan produk melalui video masih menyumbang secara sihat kepada keseluruhan akaun.";
            prodAction = "Optimasi 'Call-To-Action' (CTA) di dalam video untuk kekalkan momentum conversion yang sedia ada.";
        }

        const liveChange = getChange(c.totalLiveGmv, p.totalLiveGmv);
        let liveComment = "";
        let liveAction = "";
        if (liveChange < -15) {
            liveComment = "Live Funnel dikesan bermasalah. Trafik mungkin masuk tetapi engagement di dalam Live rendah (CTR high / CTOR low), menunjukkan tawaran (offer) mungkin sudah tepu.";
            liveAction = "Lakukan Live Repair: Panaskan audiens dengan 'Pre-heat Video' 1 jam sebelum live. Push Bundle Deal sewaktu peak hours untuk naikkan AOV (Average Order Value).";
        } else {
            liveComment = "Prestasi Live stabil. Live kini menjadi penyumbang kualiti utama walaupun dengan bajet ads yang minima.";
            liveAction = "Panjangkan durasi Live sewaktu kempen atau waktu puncak (8pm-12am) untuk leverage algoritma TikTok secara maksimum.";
        }

        let summaryRoot = "";
        if (c.totalAdsSpend > p.totalAdsSpend && saleChange < getChange(c.totalAdsSpend, p.totalAdsSpend)) {
            summaryRoot = "ROOT CAUSE: Ads Spend meningkat lebih laju dari sales. Keadaan ini tidak sihat (Unhealthy). Masalah utama bukan pada ads, tetapi pada kekurangan video delivering dan affiliate wave.";
        } else if (saleChange < 0 && c.totalAdsSpend < p.totalAdsSpend) {
            summaryRoot = "ROOT CAUSE: Fasa Penurunan Pasif. Ekosistem sedang kekurangan 'Traffic Fuel'. Punca utama adalah kurangnya aktiviti post-campaign atau ketiadaan content baru yang viral.";
        } else {
            summaryRoot = "ROOT CAUSE: Momentum Positif. Ekosistem berada dalam keadaan 'Healthy'. Kunci kejayaan adalah konsistensi dalam content dan live supply.";
        }

        return {
            sale: { change: saleChange, comment: saleComment, action: saleAction, curr: c.totalSale || 0, prev: p.totalSale || 0 },
            prod: { change: prodChange, comment: prodComment, action: prodAction, curr: prodCurr, prev: prodPrev },
            live: { change: liveChange, comment: liveComment, action: liveAction, curr: c.totalLiveGmv || 0, prev: p.totalLiveGmv || 0 },
            summary: summaryRoot,
            roi: { curr: c.roiTotal || 0, prev: p.roiTotal || 0, change: roiChange }
        };
    }, [currentData, comparisonData]);

    // --- AUTO PUBLISH LOGIC ---
    useEffect(() => {
        const autoPublish = async () => {
            if (!report || !dateRange[0] || !dateRange[1]) return;

            const rangeKey = `${dateRange[0].toISOString()}_${dateRange[1].toISOString()}`;
            if (lastPublishedRange.current === rangeKey) return;

            try {
                // Check if Version 1 already exists
                const checkRes = await api.get(`/api/reports/check?startDate=${dateRange[0].toISOString()}&endDate=${dateRange[1].toISOString()}&version=1`);

                if (!checkRes.data.exists) {
                    await api.post('/api/reports', {
                        clientName: 'TikTok Shop Client',
                        startDate: dateRange[0].toISOString(),
                        endDate: dateRange[1].toISOString(),
                        saleAnalysis: report.sale.comment,
                        saleRecommendation: report.sale.action,
                        prodAnalysis: report.prod.comment,
                        prodRecommendation: report.prod.action,
                        liveAnalysis: report.live.comment,
                        liveRecommendation: report.live.action,
                        summaryContent: report.summary,
                        version: 1
                    });
                    console.log('Report Auto-Published (V1)');
                } else {
                    console.log('Report V1 already exists');
                    // If it exists, we could potentially set currentVersion to latest here
                }
                lastPublishedRange.current = rangeKey;
            } catch (err) {
                console.error('Auto-publish failed', err);
            }
        };

        if (!loading && report) {
            autoPublish();
        }
    }, [report, loading, dateRange]);

    const handlePublishNewVersion = async () => {
        if (!report || !dateRange[0] || !dateRange[1]) return;

        setIsSaving(true);
        try {
            const nextVersion = currentVersion + 1;
            const getVal = (section: string, type: string, defaultVal: string) =>
                editedContent[`${section}_${type}`] || defaultVal;

            await api.post('/api/reports', {
                clientName: 'TikTok Shop Client',
                startDate: dateRange[0].toISOString(),
                endDate: dateRange[1].toISOString(),
                saleAnalysis: getVal('sale', 'comment', report.sale.comment),
                saleRecommendation: getVal('sale', 'action', report.sale.action),
                prodAnalysis: getVal('prod', 'comment', report.prod.comment),
                prodRecommendation: getVal('prod', 'action', report.prod.action),
                liveAnalysis: getVal('live', 'comment', report.live.comment),
                liveRecommendation: getVal('live', 'action', report.live.action),
                summaryContent: getVal('summary', 'main', report.summary),
                version: nextVersion
            });

            setCurrentVersion(nextVersion);
            setEditStates({});
            alert(`Report Published as New Version (V${nextVersion})`);
        } catch (err) {
            console.error('Publish failed', err);
            alert('Failed to publish version.');
        }
        setIsSaving(false);
    };

    const isAnyEditing = Object.values(editStates).some(s => s === true);

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all duration-300">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <FileText className="text-gray-400" size={28} />
                            Auto Analysis Report
                        </h1>
                        <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-100 uppercase tracking-tighter flex items-center gap-1">
                            <CheckCircle size={10} /> Published V{currentVersion}
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1 font-medium italic">Automated Performance Diagnosis & Report Engine</p>
                </div>
                <div className="flex items-center gap-4">
                    {isAnyEditing && (
                        <button
                            onClick={handlePublishNewVersion}
                            disabled={isSaving}
                            className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-800 disabled:bg-gray-300 transition-all shadow-lg animate-in fade-in zoom-in duration-300"
                        >
                            <Send size={16} />
                            Publish New Version
                        </button>
                    )}
                    <div className="bg-gray-50 p-1 rounded-xl border border-gray-100">
                        <DateRangePicker
                            startDate={dateRange[0]}
                            endDate={dateRange[1]}
                            onChange={setDateRange}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 space-y-6">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-gray-100 border-t-black rounded-full animate-spin"></div>
                        <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black" size={24} />
                    </div>
                    <p className="text-gray-500 font-bold tracking-widest uppercase text-xs animate-pulse">Diagnosing Performance...</p>
                </div>
            ) : !report ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 flex flex-col items-center gap-4">
                    <AlertCircle size={40} className="text-gray-200" />
                    <p className="font-medium">Sila pilih julat tarikh untuk memulakan diagnosis.</p>
                </div>
            ) : (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Metrics Overview Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MiniMetric label="Total Sale" value={report.sale.curr} format="RM" change={report.sale.change} />
                        <MiniMetric label="GMV Product" value={report.prod.curr} format="RM" change={report.prod.change} />
                        <MiniMetric label="Live GMV" value={report.live.curr} format="RM" change={report.live.change} />
                        <MiniMetric label="Total ROI" value={report.roi.curr} format="x" change={report.roi.change} />
                    </div>

                    {/* Section 1: Total Sale */}
                    <ReportCard
                        sectionId="sale"
                        number="1"
                        title="TOTAL SALE PERFORMANCE"
                        curr={report.sale.curr}
                        prev={report.sale.prev}
                        change={report.sale.change}
                        comment={report.sale.comment}
                        action={report.sale.action}
                        format="RM"
                        editedContent={editedContent}
                        setEditedContent={setEditedContent}
                        editStates={editStates}
                        setEditStates={setEditStates}
                    />

                    {/* Section 2: GMV Product */}
                    <ReportCard
                        sectionId="prod"
                        number="2"
                        title="TOTAL GMV (VIDEO / PRODUCT)"
                        curr={report.prod.curr}
                        prev={report.prod.prev}
                        change={report.prod.change}
                        comment={report.prod.comment}
                        action={report.prod.action}
                        format="RM"
                        editedContent={editedContent}
                        setEditedContent={setEditedContent}
                        editStates={editStates}
                        setEditStates={setEditStates}
                    />

                    {/* Section 3: Live GMV */}
                    <ReportCard
                        sectionId="live"
                        number="3"
                        title="LIVE GMV PERFORMANCE"
                        curr={report.live.curr}
                        prev={report.live.prev}
                        change={report.live.change}
                        comment={report.live.comment}
                        action={report.live.action}
                        format="RM"
                        editedContent={editedContent}
                        setEditedContent={setEditedContent}
                        editStates={editStates}
                        setEditStates={setEditStates}
                    />

                    {/* Section 4: Summary */}
                    <div className="bg-black text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <div className="flex items-center gap-3">
                                <span className="w-[36px] h-[36px] rounded-full bg-white text-black flex items-center justify-center font-bold text-[18px] shadow-[0_2px_6px_rgba(0,0,0,0.25)] shrink-0">
                                    4
                                </span>
                                <h2 className="text-xl font-bold flex items-center gap-3 tracking-tight">
                                    <Target size={20} className="text-white/80" />
                                    OVERALL SUMMARY & ACTION PLAN
                                </h2>
                            </div>

                            <SectionControls
                                isEditing={editStates['summary']}
                                onEdit={() => setEditStates({ ...editStates, summary: true })}
                                onSave={() => setEditStates({ ...editStates, summary: false })}
                                onCancel={() => {
                                    setEditStates({ ...editStates, summary: false });
                                    const next = { ...editedContent };
                                    delete next.summary_main;
                                    setEditedContent(next);
                                }}
                                dark
                            />
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
                                <div className="flex items-center gap-2 text-white/40 uppercase text-[10px] font-bold tracking-widest mb-3">
                                    <Target size={14} /> DIAGNOSIS SUMMARY
                                </div>
                                {editStates['summary'] ? (
                                    <textarea
                                        className="w-full bg-white/5 border border-white/20 rounded-xl p-4 text-white font-bold leading-relaxed focus:outline-none focus:border-white/40 min-h-[120px]"
                                        value={editedContent.summary_main ?? report.summary}
                                        onChange={(e) => setEditedContent({ ...editedContent, summary_main: e.target.value })}
                                    />
                                ) : (
                                    <p className="text-white font-bold leading-relaxed text-lg">
                                        {editedContent.summary_main ?? report.summary}
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ActionPoint text="Prioritaskan 'Content Supply' melebihi 'Ads Spend' jika ROI terus menjunam." />
                                <ActionPoint text="Segera bersihkan Funnel 'Awareness' menggunakan video jenis VSP." />
                                <ActionPoint text="Aktifkan Affiliate Guerilla untuk memintas algoritma berbayar." />
                                <ActionPoint text="Fokus pada 'Product Card Max Adjustment' untuk tingkatkan jualan organik." />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUB-COMPONENTS ---

const SectionControls = ({ isEditing, onEdit, onSave, onCancel, dark }: any) => {
    if (isEditing) {
        return (
            <div className="flex items-center gap-2">
                <button
                    onClick={onSave}
                    className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors", dark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800")}
                >
                    <Save size={14} /> Close
                </button>
                <button
                    onClick={onCancel}
                    className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors", dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
                >
                    <X size={14} /> Revert
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={onEdit}
            className={clsx("flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all border border-transparent", dark ? "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-black hover:border-gray-300")}
        >
            <Edit size={14} /> Edit Report
        </button>
    );
};

const MiniMetric = ({ label, value, format, change }: any) => {
    const isPos = change >= 0;
    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">
                    {format === 'RM' ? `RM${(value / 1000).toFixed(1)}k` : value.toFixed(2)}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPos ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                    {isPos ? '▲' : '▼'} {Math.abs(change).toFixed(0)}%
                </span>
            </div>
        </div>
    );
};

const ReportCard = ({
    sectionId, number, title, curr, prev, change, comment, action, format,
    editedContent, setEditedContent, editStates, setEditStates
}: any) => {
    const isPos = change >= 0;
    const isEditing = editStates[sectionId];

    const currentComment = editedContent[`${sectionId}_comment`] ?? comment;
    const currentAction = editedContent[`${sectionId}_action`] ?? action;

    return (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col group/card">
            <div className="p-6 md:py-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-[36px] h-[36px] rounded-full bg-white text-black flex items-center justify-center font-bold text-[18px] shadow-[0_2px_6px_rgba(0,0,0,0.25)] shrink-0 border border-gray-100">
                        {number}
                    </span>
                    <h3 className="font-black text-xl text-gray-900 tracking-tight">{title}</h3>
                </div>

                <div className="flex items-center gap-4">
                    <SectionControls
                        isEditing={isEditing}
                        onEdit={() => setEditStates({ ...editStates, [sectionId]: true })}
                        onSave={() => setEditStates({ ...editStates, [sectionId]: false })}
                        onCancel={() => {
                            setEditStates({ ...editStates, [sectionId]: false });
                            const next = { ...editedContent };
                            delete next[`${sectionId}_comment`];
                            delete next[`${sectionId}_action`];
                            setEditedContent(next);
                        }}
                    />

                    <div className="flex items-center gap-6 bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100">
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Semasa</p>
                            <p className="text-sm font-bold text-gray-900">{format === 'RM' ? `RM ${curr.toLocaleString()}` : curr.toFixed(2)}</p>
                        </div>
                        <div className="h-4 w-px bg-gray-200"></div>
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sebelum</p>
                            <p className="text-sm font-bold text-gray-500">{format === 'RM' ? `RM ${prev.toLocaleString()}` : prev.toFixed(2)}</p>
                        </div>
                        <div className={clsx(
                            "flex items-center gap-1 font-bold text-sm ml-2",
                            isPos ? "text-green-600" : "text-red-600"
                        )}>
                            {isPos ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            {Math.abs(change).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 p-1 gap-px bg-gray-100">
                <div className="p-8 bg-white flex flex-col gap-5">
                    <div className="flex items-center gap-2 text-gray-400 uppercase text-[10px] font-bold tracking-widest">
                        <Info size={16} /> ANALYSIS
                    </div>
                    {isEditing ? (
                        <textarea
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 leading-relaxed font-semibold text-lg focus:outline-none focus:border-black min-h-[120px]"
                            value={currentComment}
                            onChange={(e) => setEditedContent({ ...editedContent, [`${sectionId}_comment`]: e.target.value })}
                        />
                    ) : (
                        <p className="text-gray-700 leading-relaxed font-semibold text-lg">
                            {currentComment}
                        </p>
                    )}
                </div>
                <div className="p-8 bg-gray-50/80 flex flex-col gap-5">
                    <div className="flex items-center gap-2 text-black uppercase text-[10px] font-bold tracking-widest">
                        <Zap size={16} className="text-yellow-500 fill-yellow-500" /> RECOMMENDATION
                    </div>
                    {isEditing ? (
                        <textarea
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-900 leading-relaxed font-black text-lg italic focus:outline-none focus:border-black min-h-[120px]"
                            value={currentAction}
                            onChange={(e) => setEditedContent({ ...editedContent, [`${sectionId}_action`]: e.target.value })}
                        />
                    ) : (
                        <p className="text-gray-900 leading-relaxed font-black text-lg italic">
                            "{currentAction}"
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const ActionPoint = ({ text }: { text: string }) => (
    <div className="flex items-start gap-3 group">
        <CheckCircle2 size={18} className="text-green-400 mt-0.5 group-hover:scale-110 transition-transform" />
        <span className="text-sm text-gray-300 font-medium leading-tight">{text}</span>
    </div>
);

export default AutoAnalysis;
