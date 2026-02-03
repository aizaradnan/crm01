import { useState, useMemo } from 'react';
import { Calculator, RefreshCcw, Info, Target, Zap, AlertTriangle, ArrowRight, Wallet, ShoppingBag } from 'lucide-react';
import clsx from 'clsx';

const DEFAULT_FEES = {
    shippingFee: 5,
    marketplaceFee: 6.97,
    transactionFee: 3.78,
    completedOrderFee: 0.54
};

const PricingLab = () => {
    // A1 - Basic Cost Inputs
    const [productCost, setProductCost] = useState<number | ''>(15);
    const [affiliateComm, setAffiliateComm] = useState<number | ''>(10);
    const [liveHostFee, setLiveHostFee] = useState<number | ''>(2);
    const [targetProfit, setTargetProfit] = useState<number | ''>(20);

    // A2 - TikTok & Operational Fees
    const [fees, setFees] = useState(DEFAULT_FEES);

    // E - Impact Simulator (Dynamic overrides)
    const [simPrice, setSimPrice] = useState<number | ''>('');

    const resetFees = () => setFees(DEFAULT_FEES);

    // Calculation Engine
    const results = useMemo(() => {
        const pc = Number(productCost) || 0;
        const ac = Number(affiliateComm) || 0;
        const lh = Number(liveHostFee) || 0;
        const tp = Number(targetProfit) || 0;

        const sumFeesPct = fees.shippingFee + fees.marketplaceFee + fees.transactionFee + ac;
        const fixedCosts = pc + lh + fees.completedOrderFee;

        // 1. Minimum Selling Price (Breakeven)
        // S = Fixed / (1 - SumFeesPct/100)
        const breakevenPrice = fixedCosts / (1 - (sumFeesPct / 100));

        // 2. Recommended Selling Price
        // S = Fixed / (1 - (SumFeesPct + TargetProfit)/100)
        const recommendedPrice = fixedCosts / (1 - ((sumFeesPct + tp) / 100));

        // Use Simulator Price if set, otherwise use Recommended Price for ROI/ROAS logic
        const activePrice = Number(simPrice) || recommendedPrice;

        // Breakdown based on activePrice
        const breakdown = {
            productCost: pc,
            tiktokFees: activePrice * ((fees.shippingFee + fees.marketplaceFee + fees.transactionFee) / 100) + fees.completedOrderFee,
            affiliateCost: activePrice * (ac / 100),
            liveHostCost: lh,
            totalCost: 0,
            profitAmount: 0
        };
        breakdown.totalCost = pc + breakdown.tiktokFees + breakdown.affiliateCost + lh;
        breakdown.profitAmount = activePrice - breakdown.totalCost;

        // C. BREAKEVEN ROAS (NO PROFIT)
        // Correct Formula: ROAS = Selling Price / (Selling Price - Total Cost)
        // Profit = Revenue - Ads - TotalCost. Set Profit = 0 -> Ads = Revenue - TotalCost
        const marginForAdsBE = activePrice - breakdown.totalCost;
        const beRoas = marginForAdsBE > 0 ? activePrice / marginForAdsBE : 0;

        // D. TARGET ROI FOR TARGET PROFIT
        // Correct Formula: ROAS = Selling Price / (Selling Price - (Total Cost + ProfitAmount))
        const targetProfitAmount = activePrice * (tp / 100);
        const marginForAdsTarget = activePrice - (breakdown.totalCost + targetProfitAmount);
        const targetRoi = marginForAdsTarget > 0 ? activePrice / marginForAdsTarget : 0;

        const isInvalid = activePrice <= (breakdown.totalCost + targetProfitAmount);

        return {
            breakevenPrice,
            recommendedPrice,
            activePrice,
            breakdown,
            beRoas,
            targetRoi,
            isInvalid,
            targetProfitAmount
        };
    }, [productCost, affiliateComm, liveHostFee, targetProfit, fees, simPrice]);

    const formatRM = (val: number) => `RM ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 font-outfit">
                        <Calculator className="text-black" size={28} />
                        Pricing & Breakeven Lab
                    </h1>
                    <p className="text-gray-500 text-sm mt-1 font-medium font-inter">Financial planning tool for TikTok Shop strategy</p>
                </div>
                <div className="bg-black/5 px-4 py-2 rounded-xl border border-black/5 flex items-center gap-2">
                    <Target size={16} className="text-black/60" />
                    <span className="text-xs font-bold text-black border-r border-black/10 pr-2 mr-2">LAB MODE</span>
                    <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest">Pre-Campaign Planning</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Inputs */}
                <div className="lg:col-span-5 space-y-8">
                    {/* Block A: COST STRUCTURE */}
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="font-bold flex items-center gap-2 text-gray-900 tracking-tight">
                                <Wallet size={18} className="text-gray-400" />
                                A — COST STRUCTURE
                            </h2>
                        </div>

                        <div className="p-6 space-y-8">
                            {/* A1: Basic Inputs */}
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <ArrowRight size={12} /> A1 — Basic Cost Inputs
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputBlock label="Cost Produk (RM)" value={productCost} onChange={setProductCost} prefix="RM" />
                                    <InputBlock label="Affiliate (%)" value={affiliateComm} onChange={setAffiliateComm} suffix="%" />
                                    <InputBlock label="Live Host (RM)" value={liveHostFee} onChange={setLiveHostFee} prefix="RM" />
                                    <InputBlock label="Target Profit (%)" value={targetProfit} onChange={setTargetProfit} suffix="%" />
                                </div>
                            </div>

                            {/* A2: TikTok Fees */}
                            <div className="space-y-4 border-t border-gray-100 pt-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <ArrowRight size={12} /> A2 — TikTok Fees
                                    </h3>
                                    <button
                                        onClick={resetFees}
                                        className="text-[10px] font-bold text-black/60 hover:text-black flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md transition-all"
                                    >
                                        <RefreshCcw size={10} /> Reset
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputBlock label="Shipping Fee" value={fees.shippingFee} onChange={(v: number | string) => setFees({ ...fees, shippingFee: Number(v) || 0 })} suffix="%" />
                                    <InputBlock label="Marketplace" value={fees.marketplaceFee} onChange={(v: number | string) => setFees({ ...fees, marketplaceFee: Number(v) || 0 })} suffix="%" />
                                    <InputBlock label="Transaction" value={fees.transactionFee} onChange={(v: number | string) => setFees({ ...fees, transactionFee: Number(v) || 0 })} suffix="%" />
                                    <InputBlock label="Order Fee" value={fees.completedOrderFee} onChange={(v: number | string) => setFees({ ...fees, completedOrderFee: Number(v) || 0 })} prefix="RM" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Block E: IMPACT SIMULATOR */}
                    <div className="bg-black text-white rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap size={120} className="rotate-12" />
                        </div>
                        <div className="relative z-10 space-y-6">
                            <h2 className="font-bold flex items-center gap-2 tracking-tight">
                                <RefreshCcw size={18} className="text-yellow-400" />
                                E — IMPACT SIMULATOR (LAB)
                            </h2>
                            <div className="space-y-4">
                                <p className="text-gray-400 text-xs">Uji harga jualan secara manual untuk melihat kesan pada ROI & Margin secara langsung.</p>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-2xl font-black text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-400/50 transition-all"
                                        placeholder="Set Harga Jualan Sini..."
                                        value={simPrice}
                                        onChange={(e) => setSimPrice(e.target.value === '' ? '' : Number(e.target.value))}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 font-black text-xl">RM</span>
                                </div>
                                {simPrice && (
                                    <button
                                        onClick={() => setSimPrice('')}
                                        className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest flex items-center gap-1"
                                    >
                                        <XSmall size={10} /> Bersihkan Simulator
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="lg:col-span-7 space-y-8">
                    {/* Block B: SAFE SELLING PRICE */}
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="font-bold flex items-center gap-2 text-gray-900 tracking-tight">
                                <ShoppingBag size={18} className="text-gray-400" />
                                B — SAFE SELLING PRICE CALCULATOR
                            </h2>
                        </div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-gray-100">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">1) Minimum Price (Breakeven)</p>
                                <p className="text-3xl font-black text-gray-400 font-outfit">{formatRM(results.breakevenPrice)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">2) Recommended Price</p>
                                <p className="text-3xl font-black text-black font-outfit">{formatRM(results.recommendedPrice)}</p>
                                <p className="text-[10px] font-bold text-gray-400">Termasuk {targetProfit}% Target Profit</p>
                            </div>
                        </div>

                        <div className="p-8 bg-gray-50/30">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-100 pb-2">Analysis Breakdown (Selling at {formatRM(results.activePrice)})</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                <BreakdownItem label="Product Cost" value={results.breakdown.productCost} format="RM" />
                                <BreakdownItem label="TikTok Fees" value={results.breakdown.tiktokFees} format="RM" />
                                <BreakdownItem label="Affiliate Cost" value={results.breakdown.affiliateCost} format="RM" />
                                <BreakdownItem label="Live Host" value={results.breakdown.liveHostCost} format="RM" />
                                <BreakdownItem label="Total Cost" value={results.breakdown.totalCost} format="RM" bold />
                                <BreakdownItem
                                    label="Profit Amount"
                                    value={results.breakdown.profitAmount}
                                    format="RM"
                                    accent={results.breakdown.profitAmount >= 0 ? 'text-green-600' : 'text-red-600'}
                                    bold
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Block C: BREAKEVEN ROAS (NO PROFIT) */}
                        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm flex flex-col justify-between gap-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 text-red-50 opacity-[0.03]">
                                <AlertTriangle size={120} />
                            </div>
                            <div>
                                <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Info size={14} /> C — BREAKEVEN ROAS (NO PROFIT)
                                </h2>
                                <p className={clsx("text-5xl font-black font-outfit", results.beRoas > 0 ? "text-red-600" : "text-gray-300")}>
                                    {results.beRoas > 0 ? results.beRoas.toFixed(2) : "N/A"}
                                </p>
                            </div>
                            <div className="bg-red-50/50 p-4 rounded-2xl border border-red-50 text-red-700">
                                <p className="text-[11px] font-bold leading-relaxed">
                                    ROI di bawah angka ini = rugi. ROI sama dengan angka ini = tidak untung, tidak rugi.
                                </p>
                            </div>
                        </div>

                        {/* Block D: TARGET ROI FOR TARGET PROFIT */}
                        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm flex flex-col justify-between gap-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 text-green-50 opacity-[0.03]">
                                <Zap size={120} />
                            </div>
                            <div>
                                <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Target size={14} /> D — TARGET ROI FOR TARGET PROFIT
                                </h2>
                                <p className={clsx("text-5xl font-black font-outfit", results.targetRoi > 0 ? "text-green-600" : "text-gray-300")}>
                                    {results.targetRoi > 0 ? results.targetRoi.toFixed(2) : "N/A"}
                                </p>
                            </div>
                            <div className="bg-green-50/50 p-4 rounded-2xl border border-green-50 text-green-700">
                                <p className="text-[11px] font-bold leading-relaxed">
                                    Gunakan angka ini sebagai sasaran ROI untuk capai target profit yang ditetapkan.
                                </p>
                            </div>
                        </div>
                    </div>

                    {results.isInvalid && (
                        <div className="bg-red-600 text-white p-6 rounded-3xl flex items-start gap-4 animate-bounce">
                            <AlertTriangle size={24} className="shrink-0" />
                            <div className="space-y-1">
                                <p className="font-bold uppercase tracking-tight">Warning: Invalid Pricing Structure</p>
                                <p className="text-sm opacity-90 leading-tight">
                                    Harga jualan (RM {results.activePrice.toFixed(2)}) terlalu rendah untuk menampung Kos + Target Profit. Sila naikkan harga atau turunkan target profit.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Summary Tip */}
                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
                        <div className="bg-blue-600 text-white p-2 rounded-xl">
                            <Info size={20} />
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-blue-900">Lab Strategy Tip</p>
                            <p className="text-sm text-blue-800/80 leading-relaxed font-inter">
                                Penurunan 5% pada Affiliate Commission boleh menurunkan Breakeven ROAS anda sebanyak ~0.2x. Sentiasa uji margin anda di sini sebelum melancarkan kempen besar.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Helpers ---

const InputBlock = ({ label, value, onChange, prefix, suffix }: any) => (
    <div className="space-y-1.5 flex flex-col">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="relative group/input">
            {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">{prefix}</span>}
            <input
                type="number"
                className={clsx(
                    "w-full bg-white border border-gray-200 rounded-xl py-2.5 px-4 font-bold text-gray-900 focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-sm",
                    prefix && "pl-8",
                    suffix && "pr-8"
                )}
                value={value}
                onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            />
            {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">{suffix}</span>}
        </div>
    </div>
);

const BreakdownItem = ({ label, value, format, accent = 'text-gray-900', bold = false }: any) => (
    <div className="space-y-1">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className={clsx(
            "text-base tracking-tight font-outfit",
            accent,
            bold ? "font-black" : "font-bold"
        )}>
            {format === 'RM' ? `RM ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : value}
        </p>
    </div>
);

const XSmall = ({ size, className }: { size: number, className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
);

export default PricingLab;
