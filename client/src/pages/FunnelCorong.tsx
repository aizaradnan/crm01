import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../lib/api';

interface FunnelMetrics {
    visitor: number;
    customers: number;
    revenue: number;
    ads: number;
}

interface DerivedMetrics {
    cr: number;
    aov: number;
    rpv: number;
    cac: number;
    roi: number;
}

interface FunnelLevelProps {
    label: string;
    mainValue: string;
    subValues?: string[];
    comparisonValue: string;
    status: 'green' | 'yellow' | 'red';
    description: string;
    width: string;
}

const FunnelLevel = ({ label, mainValue, subValues, comparisonValue, status, description, width }: FunnelLevelProps) => {
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

            {/* Right: Previous Period Comparison */}
            <div className="flex flex-col items-end pl-4 md:border-l border-current/20">
                <span className="text-xs font-semibold uppercase opacity-70">Vs Prev Period</span>
                <div className="flex items-center gap-1 font-bold">
                    {getStatusIcon()}
                    <span>{comparisonValue}</span>
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

const FunnelCorong = () => {
    // Default to last 7 days
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
        new Date(new Date().setDate(new Date().getDate() - 7)),
        new Date()
    ]);
    const [startDate, endDate] = dateRange;

    const [loading, setLoading] = useState(false);
    const [currentMetrics, setCurrentMetrics] = useState<FunnelMetrics | null>(null);
    const [prevMetrics, setPrevMetrics] = useState<FunnelMetrics | null>(null);

    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate]);

    const fetchData = async () => {
        if (!startDate || !endDate) return;

        setLoading(true);
        try {
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];

            console.log(`Fetching Funnel metrics for range: ${startStr} to ${endStr}`);

            const res = await api.get(`/funnel-metrics?startDate=${startStr}&endDate=${endStr}`);

            setCurrentMetrics(res.data.current);
            setPrevMetrics(res.data.previous);

        } catch (err) {
            console.error("Failed to fetch funnel data", err);
        }
        setLoading(false);
    };

    const calculateDerived = (m: FunnelMetrics): DerivedMetrics => {
        const cr = m.visitor > 0 ? (m.customers / m.visitor * 100) : 0;
        const aov = m.customers > 0 ? (m.revenue / m.customers) : 0;
        const rpv = m.visitor > 0 ? (m.revenue / m.visitor) : 0;
        const cac = m.customers > 0 ? (m.ads / m.customers) : 0;
        const roi = m.ads > 0 ? (m.revenue / m.ads) : 0;

        return { cr, aov, rpv, cac, roi };
    };

    const getPercentageDiff = (current: number, prev: number) => {
        if (prev === 0) return current > 0 ? 100 : 0;
        return ((current - prev) / prev) * 100;
    };

    const formatDiff = (diff: number) => {
        const sign = diff > 0 ? '+' : '';
        return `${sign}${diff.toFixed(1)}%`;
    };

    const getStatus = (diff: number, invert = false) => {
        // Default: Positive diff is Green, Negative is Red
        // Invert (Cost): Positive diff is Red, Negative is Green

        if (diff === 0) return 'yellow';

        if (invert) {
            return diff < 0 ? 'green' : 'red';
        } else {
            return diff > 0 ? 'green' : 'red';
        }
    };

    // Render Logic
    if (!currentMetrics || !prevMetrics) return <div className="p-10 text-center">Loading Data...</div>;

    const currDerived = calculateDerived(currentMetrics);
    const prevDerived = calculateDerived(prevMetrics);

    // Diffs
    const visitorDiff = getPercentageDiff(currentMetrics.visitor, prevMetrics.visitor);
    const crDiff = getPercentageDiff(currDerived.cr, prevDerived.cr);
    const aovDiff = getPercentageDiff(currDerived.aov, prevDerived.aov);
    const cacDiff = getPercentageDiff(currDerived.cac, prevDerived.cac);
    const roiDiff = getPercentageDiff(currDerived.roi, prevDerived.roi);

    // Custom Date Input
    // eslint-disable-next-line react/display-name
    const CustomDateInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
        ({ value, onClick }, ref) => (
            <button
                onClick={onClick}
                ref={ref}
                className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-300 hover:border-black transition-colors shadow-sm"
            >
                <Calendar size={18} className="text-gray-600" />
                <span className="font-medium text-gray-900">{value}</span>
            </button>
        )
    );

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        Funnel "Corong" Diagnosis
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Analyzing performance vs previous period.
                    </p>
                </div>

                <div>
                    <DatePicker
                        selectsRange={true}
                        startDate={startDate}
                        endDate={endDate}
                        onChange={(update) => setDateRange(update)}
                        dateFormat="dd/MM/yyyy"
                        maxDate={new Date()}
                        customInput={<CustomDateInput />}
                    />
                </div>
            </div>

            {loading && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                    <span className="text-sm font-medium animate-pulse">Updating...</span>
                </div>
            )}

            <div className="flex flex-col items-center w-full space-y-1 relative">

                {/* Level 1: VISITOR */}
                <FunnelLevel
                    label="1. VISITOR"
                    mainValue={currentMetrics.visitor.toLocaleString()}
                    comparisonValue={formatDiff(visitorDiff)}
                    status={getStatus(visitorDiff)}
                    width="100%"
                    description="Total Visitors in selected period vs previous period."
                />

                {/* Level 2: CUSTOMERS */}
                <FunnelLevel
                    label="2. CUSTOMERS"
                    mainValue={currentMetrics.customers.toLocaleString()}
                    subValues={[`CR: ${currDerived.cr.toFixed(2)}%`]}
                    comparisonValue={formatDiff(crDiff)} // Compare CR, not raw customers? Usually CR is better metric. Let's compare CR.
                    status={getStatus(crDiff)}
                    width="90%"
                    description="Conversion Rate comparison."
                />

                {/* Level 3: REVENUE */}
                <FunnelLevel
                    label="3. REVENUE"
                    mainValue={`RM ${currentMetrics.revenue.toLocaleString()}`}
                    subValues={[
                        `AOV: RM ${currDerived.aov.toFixed(2)}`,
                        `RPV: RM ${currDerived.rpv.toFixed(2)}`
                    ]}
                    comparisonValue={formatDiff(aovDiff)} // Comparing AOV
                    status={getStatus(aovDiff)}
                    width="80%"
                    description="Average Order Value comparison."
                />

                {/* Level 4: ADS COST */}
                <FunnelLevel
                    label="4. ADS COST"
                    mainValue={`RM ${currentMetrics.ads.toLocaleString()}`}
                    subValues={[`CAC: RM ${currDerived.cac.toFixed(2)}`]}
                    comparisonValue={formatDiff(cacDiff)} // Comparing CAC
                    status={getStatus(cacDiff, true)} // Invert: Lower CAC is better
                    width="70%"
                    description="Customer Acquisition Cost comparison."
                />

                {/* Level 5: ROI */}
                <FunnelLevel
                    label="5. ROI"
                    mainValue={`${currDerived.roi.toFixed(2)}x`}
                    comparisonValue={formatDiff(roiDiff)}
                    status={getStatus(roiDiff)}
                    width="60%"
                    description="Return on Ad Spend comparison."
                />
            </div>
        </div>
    );
};

export default FunnelCorong;
