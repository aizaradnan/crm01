import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../lib/api';
import DateRangePicker from '../components/DateRangePicker';
import { Zap, LayoutGrid, Filter } from 'lucide-react';
import FunnelDiagnosis from '../components/FunnelDiagnosis';

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

const Dashboard = () => {
    // Default to last 7 days
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
    const [showSalesLine, setShowSalesLine] = useState(true);
    const [showAdsLine, setShowAdsLine] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'funnel'>('overview');

    const toLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const fetchData = async () => {
        const [start, end] = dateRange;
        if (!start || !end) return;

        setLoading(true);
        try {
            // 1. Current Range
            const startStr = toLocalDateString(start);
            const endStr = toLocalDateString(end);

            // 2. Comparison Range (Previous Period)
            // Calculate duration in days
            const duration = end.getTime() - start.getTime();
            const compEnd = new Date(start.getTime() - 86400000); // Start - 1 day
            const compStart = new Date(compEnd.getTime() - duration);

            const compStartStr = toLocalDateString(compStart);
            const compEndStr = toLocalDateString(compEnd);

            const [currentRes, compRes] = await Promise.all([
                api.get(`/summary?start=${startStr}&end=${endStr}`),
                api.get(`/summary?start=${compStartStr}&end=${compEndStr}`)
            ]);

            setCurrentData(currentRes.data);
            setComparisonData(compRes.data);
        } catch (err) {
            console.error('Failed to fetch dashboard data', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    // Calculate percentage change
    const getChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    };

    // Performance Status Badge Logic
    const getStatusBadge = () => {
        if (!currentData || !comparisonData) return { status: 'Watch', color: 'yellow', icon: '🟡' };

        const roiChange = getChange(currentData.roiTotal, comparisonData.roiTotal);
        const spendChange = getChange(currentData.totalAdsSpend, comparisonData.totalAdsSpend);

        if (roiChange >= 0 && currentData.roiTotal >= 2) {
            return { status: 'Healthy', color: 'green', icon: '🟢' };
        } else if (roiChange < -10 || (spendChange > 20 && roiChange < 0)) {
            return { status: 'Risk', color: 'red', icon: '🔴' };
        }
        return { status: 'Watch', color: 'yellow', icon: '🟡' };
    };

    // Generate Quick Insight
    const getQuickInsight = () => {
        if (!currentData || !comparisonData) return "Loading performance data...";

        const saleChange = getChange(currentData.totalSale, comparisonData.totalSale);
        const spendChange = getChange(currentData.totalAdsSpend, comparisonData.totalAdsSpend);
        const roiChange = getChange(currentData.roiTotal, comparisonData.roiTotal);
        const liveGmvShare = currentData.totalSaleGmv > 0
            ? (currentData.totalLiveGmv / currentData.totalSaleGmv) * 100
            : 0;

        if (saleChange > 10 && liveGmvShare > 50) {
            return "Sales increased mainly driven by Live GMV performance.";
        } else if (spendChange > saleChange && roiChange < -5) {
            return "Ads Spend rose faster than sales, causing ROI decline.";
        } else if (Math.abs(saleChange) < 5 && Math.abs(roiChange) < 5) {
            return "Performance remained stable with balanced spend.";
        } else if (saleChange > 0 && roiChange > 0) {
            return "Strong performance with sales and ROI both improving.";
        } else if (saleChange < 0) {
            return "Sales declined compared to the previous period.";
        }
        return "Performance metrics are within normal range.";
    };

    const [showROILine, setShowROILine] = useState(true);

    // Chart data
    const lineChartData = useMemo(() => {
        if (!currentData?.records) return [];
        return currentData.records.map((r: any) => ({
            date: new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            totalSale: r.totalSale,
            totalAdsSpend: r.totalAdsSpend,
            roiTotal: r.roiTotal
        })).reverse();
    }, [currentData]);

    const pieChartData = useMemo(() => {
        if (!currentData) return [];
        const total = currentData.totalSale || 1;
        const gmvProduct = currentData.totalSaleGmv - currentData.totalLiveGmv;
        return [
            { name: 'GMV Product', value: gmvProduct, percentage: ((gmvProduct / total) * 100).toFixed(1) },
            { name: 'Live GMV', value: currentData.totalLiveGmv, percentage: ((currentData.totalLiveGmv / total) * 100).toFixed(1) },
            { name: 'Direct Shop', value: currentData.totalDirectShop, percentage: ((currentData.totalDirectShop / total) * 100).toFixed(1) }
        ];
    }, [currentData]);

    const statusBadge = getStatusBadge();

    // KPI Card Component
    const KPICard = ({ title, value, format, compValue }: { title: string; value: number; format: 'currency' | 'ratio' | 'percent'; compValue: number }) => {
        const change = getChange(value, compValue);
        const isPositive = change >= 0;

        return (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                        {format === 'currency' ? `RM ${value.toLocaleString()}` : format === 'percent' ? `${value.toFixed(2)}%` : value.toLocaleString()}
                    </span>
                    <div className={`flex items-center text-xs font-bold mb-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">vs previous period</p>
            </div>
        );
    };

    // Calculate Funnel Metrics Helper
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

    const currFunnel = currentData ? calcFunnel(currentData) : { visitor: 0, customers: 0, cr: 0, aov: 0, cac: 0, rpv: 0 };
    const prevFunnel = comparisonData ? calcFunnel(comparisonData) : { visitor: 0, customers: 0, cr: 0, aov: 0, cac: 0, rpv: 0 };

    return (
        <div className="space-y-8" style={{ overflow: 'visible' }}>
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        Perfume Paradise
                    </h1>
                    <p className="text-gray-500 mt-1">Performance Overview</p>
                </div>
            </div>

            {/* Controls Row: Tabs & Date Picker */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-gray-100 pb-6 relative z-50 overflow-visible">
                <div className="flex items-center gap-1 bg-gray-100/80 p-1.5 rounded-xl">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
                            }`}
                    >
                        <LayoutGrid size={16} />
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('funnel')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'funnel' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
                            }`}
                    >
                        <Filter size={16} />
                        Funnel Diagnosis
                    </button>
                </div>

                <DateRangePicker
                    startDate={dateRange[0]}
                    endDate={dateRange[1]}
                    onChange={setDateRange}
                />
            </div>

            {activeTab === 'overview' && (loading ? (
                <div className="text-center py-20 text-gray-400 animate-pulse">Loading dashboard data...</div>
            ) : (
                <>
                    {/* Status Badge (Moved to Overview Content) */}
                    <div className="flex justify-end mb-4">
                        <div className={`px-4 py-2 rounded-full text-sm font-medium border flex items-center gap-2 ${statusBadge.color === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
                            statusBadge.color === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}
                        >
                            {statusBadge.icon} {statusBadge.status}
                        </div>
                    </div>
                    {/* KPI Cards Row 1: Core Financials */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KPICard title="Total Sale" value={currentData?.totalSale || 0} format="currency" compValue={comparisonData?.totalSale || 0} />
                        <KPICard title="Total Sales GMV" value={currentData?.totalSaleGmv || 0} format="currency" compValue={comparisonData?.totalSaleGmv || 0} />
                        <KPICard title="Total ROI" value={currentData?.roiTotal || 0} format="ratio" compValue={comparisonData?.roiTotal || 0} />
                        <KPICard title="Ads Spend" value={currentData?.totalAdsSpend || 0} format="currency" compValue={comparisonData?.totalAdsSpend || 0} />
                    </div>

                    {/* Funnel & Value Metrics Grid */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200">
                        <div className="flex items-center gap-2 mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Funnel & Value Metrics</h2>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase">Auto-Calculated</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <KPICard title="Visitor" value={currFunnel.visitor} format="ratio" compValue={prevFunnel.visitor} />
                            <KPICard title="Customers" value={currFunnel.customers} format="ratio" compValue={prevFunnel.customers} />
                            <KPICard title="Conversion Rate" value={currFunnel.cr} format="percent" compValue={prevFunnel.cr} />
                            <KPICard title="AOV" value={currFunnel.aov} format="currency" compValue={prevFunnel.aov} />
                            <KPICard title="CAC" value={currFunnel.cac} format="currency" compValue={prevFunnel.cac} />
                            <KPICard title="RPV" value={currFunnel.rpv} format="currency" compValue={prevFunnel.rpv} />
                        </div>
                    </div>

                    {/* Quick Insight */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
                        <div className="bg-white p-2 rounded-lg shadow-sm">
                            <Zap className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-blue-900">AI Performance Insight</h3>
                            <p className="text-blue-700 mt-1 text-sm leading-relaxed">
                                {getQuickInsight()}
                            </p>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Line Chart */}
                        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900">Trend Overview</h3>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showSalesLine}
                                            onChange={e => setShowSalesLine(e.target.checked)}
                                            className="accent-black"
                                        />
                                        <span className="text-sm text-gray-600">Sale</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showAdsLine}
                                            onChange={e => setShowAdsLine(e.target.checked)}
                                            className="accent-gray-500"
                                        />
                                        <span className="text-sm text-gray-600">Spend</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showROILine}
                                            onChange={e => setShowROILine(e.target.checked)}
                                            className="accent-blue-500"
                                        />
                                        <span className="text-sm text-gray-600">ROI</span>
                                    </label>
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={lineChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#6b7280"
                                        tick={{ fill: '#6b7280', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        stroke="#6b7280"
                                        tick={{ fill: '#6b7280', fontSize: 11 }}
                                        tickFormatter={(value) => `RM${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                                        tickLine={false}
                                        axisLine={false}
                                        dx={-10}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#3b82f6"
                                        tick={{ fill: '#3b82f6', fontSize: 11 }}
                                        tickFormatter={(value) => value.toFixed(1)}
                                        domain={[0, 'auto']}
                                        tickLine={false}
                                        axisLine={false}
                                        dx={10}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                        labelStyle={{ color: '#111827', fontWeight: 'bold', marginBottom: '8px' }}
                                        formatter={(value: any, name: any) => {
                                            if (name === "ROI (Total)") return [value.toFixed(2), name];
                                            return [`RM ${value.toLocaleString()}`, name];
                                        }}
                                    />
                                    <Legend
                                        verticalAlign="top"
                                        align="right"
                                        wrapperStyle={{ paddingBottom: '20px' }}
                                        iconType="circle"
                                    />
                                    {showSalesLine && (
                                        <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="totalSale"
                                            stroke="#111827"
                                            strokeWidth={2.5}
                                            dot={{ fill: '#111827', r: 4 }}
                                            activeDot={{ r: 6 }}
                                            name="Total Sale"
                                        />
                                    )}
                                    {showAdsLine && (
                                        <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="totalAdsSpend"
                                            stroke="#9ca3af"
                                            strokeWidth={2.5}
                                            dot={{ fill: '#9ca3af', r: 4 }}
                                            activeDot={{ r: 6 }}
                                            name="Ads Spend"
                                        />
                                    )}
                                    {showROILine && (
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="roiTotal"
                                            stroke="#3b82f6"
                                            strokeWidth={1.5}
                                            dot={{ fill: '#3b82f6', r: 3 }}
                                            activeDot={{ r: 5 }}
                                            name="ROI (Total)"
                                        />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Pie Chart */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-6">Sales Contribution</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieChartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#111827', '#4B5563', '#9CA3AF'][index % 3]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        formatter={(value: any, name: any, props: any) => [
                                            `RM ${value.toLocaleString()} (${props.payload.percentage}%)`,
                                            name
                                        ]}
                                        itemStyle={{ color: '#111827' }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        formatter={(value) => <span className="text-gray-600 text-sm">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            ))}

            {activeTab === 'funnel' && (
                <FunnelDiagnosis dateRange={dateRange} />
            )}
        </div>
    );
};

export default Dashboard;
