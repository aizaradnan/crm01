import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../lib/api';

interface DailyRecord {
    id: number;
    date: string;
    visitor: number;
    customers: number;
    totalSale: number;
    totalSaleGmv: number;
    totalAdsSpend: number;
    roiTotal: number;
    roiGmv: number;
}

interface FunnelLevelProps {
    label: string;
    mainValue: string;
    subValues?: string[];
    avgValue: string;
    comparisonLabel?: string;
    pctChange?: string;
    status: 'green' | 'yellow' | 'red';
    description: string;
    width: string;
}

const FunnelLevel = (props: FunnelLevelProps) => {
    const { label, mainValue, subValues, avgValue, status, description, width } = props;
    const [showInfo, setShowInfo] = useState(false);

    const getStatusColor = () => {
        switch (status) {
            case 'green': return 'bg-green-100 border-green-300 text-green-800';
            case 'yellow': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
            case 'red': return 'bg-red-100 border-red-300 text-red-800';
            default: return 'bg-gray-100 border-gray-300 text-gray-800';
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'green': return <TrendingUp size={16} className="text-green-600" />;
            case 'yellow': return <Minus size={16} className="text-yellow-600" />;
            case 'red': return <TrendingDown size={16} className="text-red-600" />;
        }
    };

    return (
        <div
            className={`relative flex flex-col md:flex-row items-center justify-between p-4 mb-2 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md mx-auto ${getStatusColor()}`}
            style={{ width: width }}
            onClick={() => setShowInfo(!showInfo)}
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
        >
            {/* Left/Center: Label and Main Metrics */}
            <div className="flex-1">
                <h3 className="text-lg font-bold uppercase tracking-wider">{label}</h3>
                <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold">{mainValue}</span>
                    {subValues && subValues.map((val, idx) => (
                        <span key={idx} className="text-sm font-medium opacity-80 border-l pl-2 ml-2 border-current">
                            {val}
                        </span>
                    ))}
                </div>
            </div>

            {/* Right: Average Comparison */}
            <div className="flex flex-col items-end pl-4 md:border-l border-current/20">
                <span className="text-xs font-semibold uppercase opacity-70">{props.comparisonLabel || 'Prev Period'}</span>
                <div className="flex items-center gap-1 font-bold">
                    {getStatusIcon()}
                    <span className={`text-xs ${status === 'green' ? 'text-green-600' : status === 'red' ? 'text-red-600' : 'text-yellow-600'}`}>
                        {props.pctChange}
                    </span>
                    <span className="text-gray-400 text-[10px] ml-1">({avgValue})</span>
                </div>
            </div>

            {/* Info Popup */}
            {showInfo && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-black text-white text-sm rounded-lg shadow-xl z-10 text-center animate-in fade-in slide-in-from-bottom-2">
                    {description}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-black"></div>
                </div>
            )}
        </div>
    );
};

interface FunnelDiagnosisProps {
    dateRange: [Date | null, Date | null];
}

const FunnelDiagnosis = ({ dateRange }: FunnelDiagnosisProps) => {
    const [startDate, endDate] = dateRange;
    const [loading, setLoading] = useState(true);
    const [funnelData, setFunnelData] = useState<any>(null);

    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate]);

    const fetchData = async () => {
        if (!startDate || !endDate) return;

        setLoading(true);
        try {
            // 1. Fetch CURRENT Range Data
            const startStr = startDate.toISOString().split('T')[0];
            // endStr removed as unused
            // Adjust query end date to be inclusive if needed, similar to Dashboard
            // Assuming API handles inclusive for now, or match Dashboard logic.
            const queryEndDate = new Date(endDate);
            queryEndDate.setDate(queryEndDate.getDate() + 1);
            const queryEndStr = queryEndDate.toISOString().split('T')[0];

            const currentRes = await api.get(`/records?startDate=${startStr}&endDate=${queryEndStr}`);
            const currentData = currentRes.data as DailyRecord[];

            // 2. Fetch DYNAMIC PREVIOUS PERIOD
            // Rule:
            // prev_end = selected_start - 1 day
            // range_days = (selected_end - selected_start) + 1 (in practice, just match duration)
            // prev_start = prev_end - duration

            // Calc duration in ms
            const durationMs = endDate.getTime() - startDate.getTime();

            const prevEndDate = new Date(startDate);
            prevEndDate.setDate(prevEndDate.getDate() - 1);

            const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

            const prevStartStr = prevStartDate.toISOString().split('T')[0];

            // Inclusive End Date for API
            const prevQueryEndDate = new Date(prevEndDate);
            prevQueryEndDate.setDate(prevQueryEndDate.getDate() + 1);
            const prevQueryEndStr = prevQueryEndDate.toISOString().split('T')[0];

            const historyRes = await api.get(`/records?startDate=${prevStartStr}&endDate=${prevQueryEndStr}`);
            const historyData = historyRes.data as DailyRecord[];

            processFunnelData(currentData, historyData);

        } catch (err) {
            console.error("Failed to fetch funnel data", err);
        }
        setLoading(false);
    };

    const processFunnelData = (currentRecords: DailyRecord[], historyRecords: DailyRecord[]) => {
        const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
        // avg function removed

        // 1. Current Period: SUMS (Strict Rule: Visitor=SUM, etc.)
        const currVisitor = sum(currentRecords.map(r => r.visitor || 0));
        const currCustomers = sum(currentRecords.map(r => r.customers || 0));
        const currSale = sum(currentRecords.map(r => r.totalSale));
        const currAds = sum(currentRecords.map(r => r.totalAdsSpend));

        // Derived Rates from Aggregates
        const currCR = currVisitor > 0 ? (currCustomers / currVisitor * 100) : 0;
        const currAOV = currCustomers > 0 ? (currSale / currCustomers) : 0;
        const currRPV = currVisitor > 0 ? (currSale / currVisitor) : 0;
        const currCAC = currCustomers > 0 ? (currAds / currCustomers) : 0;
        const currRoi = currAds > 0 ? (currSale / currAds) : 0;

        // 2. Previous Period: SUMS (Strict Rule same as Current)
        const prevVisitor = sum(historyRecords.map(r => r.visitor || 0));
        const prevCustomers = sum(historyRecords.map(r => r.customers || 0));
        const prevSale = sum(historyRecords.map(r => r.totalSale));
        const prevAds = sum(historyRecords.map(r => r.totalAdsSpend));

        // Derived Rates for Previous Period
        const prevCR = prevVisitor > 0 ? (prevCustomers / prevVisitor * 100) : 0;
        const prevAOV = prevCustomers > 0 ? (prevSale / prevCustomers) : 0;
        const prevRPV = prevVisitor > 0 ? (prevSale / prevVisitor) : 0;
        const prevCAC = prevCustomers > 0 ? (prevAds / prevCustomers) : 0;
        const prevRoi = prevAds > 0 ? (prevSale / prevAds) : 0;

        // Status Logic: Compare Current vs Previous Directly (Apples to Apples)
        const getStatus = (curr: number, baseline: number, invert = false) => {
            if (baseline === 0) return 'green'; // Improvement over 0
            const ratio = curr / baseline;
            if (invert) { // Lower is better (CAC)
                if (ratio <= 1.0) return 'green';
                if (ratio <= 1.1) return 'yellow';
                return 'red';
            } else { // Higher is better
                if (ratio >= 1.0) return 'green';
                if (ratio >= 0.9) return 'yellow';
                return 'red';
            }
        };

        const getPct = (curr: number, prev: number, invert = false) => {
            if (prev === 0) return curr > 0 ? (invert ? '>+100%' : '+100%') : '0%';
            const pct = ((curr - prev) / prev) * 100;
            const sign = pct > 0 ? '+' : '';
            return `${sign}${pct.toFixed(1)}%`;
        };

        setFunnelData({
            visitor: {
                value: currVisitor,
                avg: prevVisitor,
                pct: getPct(currVisitor, prevVisitor),
                status: getStatus(currVisitor, prevVisitor)
            },
            customers: {
                value: currCustomers,
                cr: currCR,
                avgCr: prevCR,
                pct: getPct(currCR, prevCR),
                status: getStatus(currCR, prevCR)
            },
            revenue: {
                value: currSale,
                aov: currAOV,
                rpv: currRPV,
                avgAov: prevAOV,
                avgRpv: prevRPV,
                pct: getPct(currSale, prevSale),
                status: getStatus(currSale, prevSale)
            },
            ads: {
                value: currAds,
                cac: currCAC,
                avgCac: prevCAC,
                pct: getPct(currCAC, prevCAC, true),
                status: getStatus(currCAC, prevCAC, true)
            },
            roi: {
                value: currRoi,
                avg: prevRoi,
                pct: getPct(currRoi, prevRoi),
                status: getStatus(currRoi, prevRoi)
            }
        });
    };

    return (
        <div className="space-y-4 py-6">
            {loading ? (
                <div className="text-center py-20 text-gray-500">
                    <p>Loading funnel data...</p>
                </div>
            ) : !funnelData ? (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500 text-lg">No data available for this range.</p>
                </div>
            ) : (
                <div className="flex flex-col items-center w-full space-y-1">

                    {/* VISITOR */}
                    <FunnelLevel
                        label="1. VISITOR"
                        mainValue={Math.round(funnelData.visitor.value).toLocaleString()}
                        comparisonLabel="Prev Period"
                        avgValue={Math.round(funnelData.visitor.avg).toLocaleString()}
                        pctChange={funnelData.visitor.pct}
                        status={funnelData.visitor.status}
                        width="100%"
                        description="Represents traffic coming into your shop or live."
                    />

                    {/* CUSTOMERS */}
                    <FunnelLevel
                        label="2. CUSTOMERS"
                        mainValue={Math.round(funnelData.customers.value).toLocaleString()}
                        subValues={[`CR: ${funnelData.customers.cr.toFixed(2)}%`]}
                        comparisonLabel="Prev Period"
                        avgValue={`CR: ${funnelData.customers.avgCr.toFixed(2)}%`}
                        pctChange={funnelData.customers.pct}
                        status={funnelData.customers.status}
                        width="90%"
                        description="Shows how many visitors converted into buyers. If low, issue is product, offer, or live."
                    />

                    {/* REVENUE */}
                    <FunnelLevel
                        label="3. REVENUE"
                        mainValue={`RM ${Math.round(funnelData.revenue.value).toLocaleString()}`}
                        subValues={[
                            `AOV: RM ${funnelData.revenue.aov.toFixed(2)}`,
                            `RPV: RM ${funnelData.revenue.rpv.toFixed(2)}`
                        ]}
                        comparisonLabel="Prev Period"
                        avgValue={`AOV: RM ${funnelData.revenue.avgAov.toFixed(0)}`}
                        pctChange={funnelData.revenue.pct}
                        status={funnelData.revenue.status}
                        width="80%"
                        description="AOV and RPV indicate quality of spending behavior."
                    />

                    {/* ADS COST */}
                    <FunnelLevel
                        label="4. ADS COST"
                        mainValue={`RM ${Math.round(funnelData.ads.value).toLocaleString()}`}
                        subValues={[`CAC: RM ${funnelData.ads.cac.toFixed(2)}`]}
                        comparisonLabel="Prev Period"
                        avgValue={`CAC: RM ${funnelData.ads.avgCac.toFixed(2)}`}
                        pctChange={funnelData.ads.pct}
                        status={funnelData.ads.status}
                        width="70%"
                        description="CAC shows how much it costs to acquire one customer."
                    />

                    {/* ROI */}
                    <FunnelLevel
                        label="5. ROI"
                        mainValue={`${funnelData.roi.value.toFixed(2)}x`}
                        comparisonLabel="Prev Period"
                        avgValue={`${funnelData.roi.avg.toFixed(2)}x`}
                        pctChange={funnelData.roi.pct}
                        status={funnelData.roi.status}
                        width="60%"
                        description="Shows ads efficiency after funnel health."
                    />
                </div>
            )}
        </div>
    );
};

export default FunnelDiagnosis;
