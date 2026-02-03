import React, { useState, useEffect, useRef, forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import api from '../lib/api';

// Custom input component with calendar icon
const CustomDateInput = forwardRef<HTMLInputElement, { value?: string; onClick?: () => void; hasError?: boolean }>(
    ({ value, onClick, hasError }, ref) => (
        <div className="relative w-full md:w-80">
            <input
                ref={ref}
                type="text"
                value={value || ''}
                onClick={onClick}
                readOnly
                placeholder="Select date..."
                className={`w-full bg-white border rounded-lg p-3 pr-12 text-gray-900 outline-none cursor-pointer transition-all hover:border-gray-400 focus:border-black ${hasError ? 'border-red-500' : 'border-gray-300'
                    }`}
            />
            <button
                type="button"
                onClick={onClick}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
            >
                <Calendar size={20} />
            </button>
        </div>
    )
);

const DataEntry = () => {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

    // Form data with NEW ADS STRUCTURE
    const [formData, setFormData] = useState({
        // Sales inputs
        totalSale: 0,
        totalSaleGmv: 0,
        gmvSaleLive: 0,
        // Ads inputs (NEW STRUCTURE)
        gmvAdsSpend: 0,       // GMV Ads Spend (Input)
        gmvLiveAdsSpend: 0,   // GMV Live Ads Spend (Input)
        ttamSpendAds: 0,      // TTAM Spend (Input)
        ttamImpressions: 0,   // TTAM Impressions (Input)
        // Funnel inputs
        visitor: 0,
        customers: 0
    });

    const [existingRecordId, setExistingRecordId] = useState<number | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [status, setStatus] = useState('');
    const [statusType, setStatusType] = useState<'success' | 'error' | 'warning'>('success');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
    const prevValuesRef = useRef<Record<string, number>>({});

    // ================================
    // REAL-TIME CALCULATED FIELDS
    // ================================

    // Sales auto-calculations
    const gmvSaleProduct = Math.max(0, formData.totalSaleGmv - formData.gmvSaleLive);
    const directShopSale = Math.max(0, formData.totalSale - formData.totalSaleGmv);

    // Ads auto-calculations (NEW FORMULAS)
    const gmvProductAdsSpend = Math.max(0, formData.gmvAdsSpend - formData.gmvLiveAdsSpend);
    const totalAdsSpend = formData.gmvAdsSpend + formData.ttamSpendAds;
    const cpm = formData.ttamImpressions > 0
        ? (formData.ttamSpendAds / formData.ttamImpressions) * 1000
        : 0;

    // ROI calculations (unchanged - use totalAdsSpend)
    // ROI calculations (unchanged - use totalAdsSpend)
    const roiTotal = totalAdsSpend > 0 ? formData.totalSale / totalAdsSpend : 0;
    const roiGmv = totalAdsSpend > 0 ? formData.totalSaleGmv / totalAdsSpend : 0;

    // Funnel calculations
    const conversionRate = formData.visitor > 0 ? (formData.customers / formData.visitor) * 100 : 0;

    // ================================
    // VALIDATION
    // ================================
    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!selectedDate || isNaN(selectedDate.getTime())) {
            errors.date = 'Please select a valid date using the calendar.';
        }
        if (formData.totalSale < formData.totalSaleGmv) {
            errors.totalSale = 'Total Sale must be ≥ Total Sale GMV';
        }
        if (formData.totalSaleGmv < formData.gmvSaleLive) {
            errors.totalSaleGmv = 'Total Sale GMV must be ≥ GMV Sale Live';
        }
        // NEW VALIDATION: GMV Ads >= GMV Live Ads
        if (formData.gmvAdsSpend < formData.gmvLiveAdsSpend) {
            errors.gmvAdsSpend = 'GMV Ads Spend must be ≥ GMV Live Ads Spend';
        }
        // Funnel Validation
        if (formData.customers > formData.visitor) {
            errors.customers = 'Customers cannot be > Visitor';
        }
        if (formData.visitor < 0) errors.visitor = 'Visitor cannot be negative';
        if (formData.customers < 0) errors.customers = 'Customers cannot be negative';

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const isValid =
        selectedDate !== null &&
        !isNaN(selectedDate.getTime()) &&
        formData.totalSale >= formData.totalSaleGmv &&
        formData.totalSaleGmv >= formData.gmvSaleLive &&
        formData.gmvAdsSpend >= formData.gmvLiveAdsSpend;

    // Visual feedback for changes
    useEffect(() => {
        const currentValues: Record<string, number> = {
            gmvSaleProduct, directShopSale, gmvProductAdsSpend, totalAdsSpend, cpm, roiTotal, roiGmv, conversionRate
        };

        const newChangedFields = new Set<string>();
        Object.entries(currentValues).forEach(([key, value]) => {
            if (prevValuesRef.current[key] !== undefined &&
                Math.abs(prevValuesRef.current[key] - value) > 0.001) {
                newChangedFields.add(key);
            }
        });

        if (newChangedFields.size > 0) {
            setChangedFields(newChangedFields);
            const timeout = setTimeout(() => setChangedFields(new Set()), 500);
            return () => clearTimeout(timeout);
        }

        prevValuesRef.current = currentValues;
    }, [gmvSaleProduct, directShopSale, gmvProductAdsSpend, totalAdsSpend, cpm, roiTotal, roiGmv, conversionRate]);

    // Check for existing record when date changes
    useEffect(() => {
        const checkExistingRecord = async () => {
            setStatus('');
            setFieldErrors({});
            setExistingRecordId(null);
            setIsEditMode(false);

            if (!selectedDate || isNaN(selectedDate.getTime())) {
                setFieldErrors({ date: 'Please select a valid date using the calendar.' });
                return;
            }

            // Convert to format: YYYY-MM-DD (Local Time)
            const year = selectedDate.getFullYear();
            const monthStr = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${monthStr}-${day}`;
            const month = `${year}-${monthStr}`;

            try {
                const res = await api.get(`/records?month=${month}`);
                const records = res.data;
                const existingRecord = records.find((r: any) =>
                    new Date(r.date).toISOString().split('T')[0] === dateStr
                );

                if (existingRecord) {
                    setExistingRecordId(existingRecord.id);
                    setIsEditMode(true);
                    setStatus('Data for this date already exists. You are now in EDIT mode.');
                    setStatusType('warning');
                    setFormData({
                        totalSale: existingRecord.totalSale,
                        totalSaleGmv: existingRecord.totalSaleGmv,
                        gmvSaleLive: existingRecord.gmvSaleLive,
                        gmvAdsSpend: existingRecord.gmvAdsSpend,
                        gmvLiveAdsSpend: existingRecord.gmvLiveAdsSpend,
                        ttamSpendAds: existingRecord.ttamSpendAds,
                        ttamImpressions: existingRecord.ttamImpressions,
                        visitor: existingRecord.visitor || 0,
                        customers: existingRecord.customers || 0
                    });
                } else {
                    setFormData({
                        totalSale: 0, totalSaleGmv: 0, gmvSaleLive: 0,
                        gmvAdsSpend: 0, gmvLiveAdsSpend: 0, ttamSpendAds: 0, ttamImpressions: 0,
                        visitor: 0, customers: 0
                    });
                }
            } catch (err) {
                console.error('Failed to check existing record', err);
            }
        };

        checkExistingRecord();
    }, [selectedDate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
        if (fieldErrors[name]) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleDateChange = (date: Date | null) => {
        setSelectedDate(date);
        if (fieldErrors.date && date) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.date;
                return newErrors;
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            setStatus('Please check your input values.');
            setStatusType('error');
            return;
        }

        setIsSubmitting(true);
        setStatus('');

        // Convert date to ISO format: YYYY-MM-DD (Local Time)
        // Avoid toISOString() as it shifts to UTC, potentially changing the date
        const year = selectedDate!.getFullYear();
        const month = String(selectedDate!.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate!.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // Build payload matching NEW backend contract
        const payload = {
            date: dateStr,
            totalSale: formData.totalSale,
            totalSaleGmv: formData.totalSaleGmv,
            gmvSaleLive: formData.gmvSaleLive,
            gmvAdsSpend: formData.gmvAdsSpend,
            gmvLiveAdsSpend: formData.gmvLiveAdsSpend,
            ttamSpendAds: formData.ttamSpendAds,
            ttamImpressions: formData.ttamImpressions
        };

        try {
            // Always use POST - backend handles upsert logic
            const response = await api.post('/records', payload);
            const result = response.data;

            if (result.status === 'success') {
                const modeText = result.mode === 'update' ? 'updated' : 'saved';
                setStatus(`Daily record ${modeText} successfully.`);
                setStatusType('success');
                setIsEditMode(true);

                // Auto-navigate to monthly data after 2 seconds
                setTimeout(() => navigate('/monthly'), 2000);
            }
        } catch (err: any) {
            setStatusType('error');

            // Handle network errors
            if (!err.response) {
                setStatus('Unable to connect to server. Please try again.');
                setIsSubmitting(false);
                return;
            }

            const errorData = err.response.data;

            // Handle structured error responses
            if (errorData.code === 'validation_error') {
                setStatus('Please check your input values.');

                // Map field-level errors
                if (errorData.errors && Array.isArray(errorData.errors)) {
                    const newFieldErrors: Record<string, string> = {};
                    errorData.errors.forEach((e: any) => {
                        if (e.path && e.path[0]) {
                            newFieldErrors[e.path[0]] = e.message;
                        }
                    });
                    setFieldErrors(newFieldErrors);
                }
            } else if (errorData.code === 'not_found') {
                setStatus('Record not found. Please refresh and try again.');
            } else if (errorData.message) {
                setStatus(errorData.message);
            } else if (err.response.status === 401) {
                setStatus('Session expired. Please log in again.');
            } else {
                setStatus('Unable to save record. Server error.');
            }
        }

        setIsSubmitting(false);
    };

    const autoFieldClass = (fieldName: string) => `
        w-full bg-gray-100 border rounded p-2 text-gray-500 cursor-not-allowed transition-all duration-300
        ${changedFields.has(fieldName)
            ? 'border-purple-500 shadow-md ring-1 ring-purple-200'
            : 'border-gray-200'}
    `;

    const inputFieldClass = (fieldName: string) => `
        w-full bg-white border rounded p-2 focus:border-black focus:ring-1 focus:ring-gray-200 outline-none transition-colors text-gray-900
        ${fieldErrors[fieldName] ? 'border-red-500' : 'border-gray-300'}
    `;

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-gray-900 tracking-tight">
                Daily Data Entry
            </h2>

            {status && (
                <div className={`p-4 rounded-lg mb-6 border ${statusType === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
                    statusType === 'warning' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                        'bg-red-50 text-red-800 border-red-200'
                    }`}>
                    {statusType === 'success' && '✅ '}
                    {statusType === 'warning' && '⚠️ '}
                    {statusType === 'error' && '❌ '}
                    {status}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Date Section */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <label className="block text-gray-700 text-sm mb-3 font-bold">
                        Transaction Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                        selected={selectedDate}
                        onChange={handleDateChange}
                        dateFormat="dd/MM/yyyy"
                        maxDate={new Date()}
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        todayButton="Today"
                        isClearable
                        placeholderText="Select date..."
                        customInput={<CustomDateInput hasError={!!fieldErrors.date} />}
                        calendarClassName="custom-calendar"
                        popperClassName="custom-popper"
                        popperPlacement="bottom-start"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        Click the calendar icon to select a date. Future dates are disabled.
                    </p>
                    {fieldErrors.date && (
                        <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                            <span>⚠️</span> {fieldErrors.date}
                        </p>
                    )}
                    {isEditMode && (
                        <div className="mt-4 inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm font-medium border border-purple-200">
                            <span className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></span>
                            EDIT MODE - Record ID: {existingRecordId}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Sales Section */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">Sales Performance</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1 font-medium">Total Sale (Input)</label>
                                <input
                                    type="number"
                                    name="totalSale"
                                    value={formData.totalSale}
                                    onChange={handleChange}
                                    className={inputFieldClass('totalSale')}
                                />
                                {fieldErrors.totalSale && (
                                    <p className="text-red-500 text-xs mt-1">{fieldErrors.totalSale}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1 font-medium">Total Sale GMV (Input)</label>
                                <input
                                    type="number"
                                    name="totalSaleGmv"
                                    value={formData.totalSaleGmv}
                                    onChange={handleChange}
                                    className={inputFieldClass('totalSaleGmv')}
                                />
                                {fieldErrors.totalSaleGmv && (
                                    <p className="text-red-500 text-xs mt-1">{fieldErrors.totalSaleGmv}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1 font-medium">GMV Sale Live (Input)</label>
                                <input
                                    type="number"
                                    name="gmvSaleLive"
                                    value={formData.gmvSaleLive}
                                    onChange={handleChange}
                                    className={inputFieldClass('gmvSaleLive')}
                                />
                            </div>

                            <div className="opacity-100">
                                <label className="block text-sm text-gray-500 mb-1">GMV Product (Auto)</label>
                                <input type="text" value={gmvSaleProduct.toFixed(2)} disabled className={autoFieldClass('gmvSaleProduct')} />
                            </div>
                            <div className="opacity-100 col-span-2">
                                <label className="block text-sm text-gray-500 mb-1">Direct Shop Sale (Auto)</label>
                                <input type="text" value={directShopSale.toFixed(2)} disabled className={autoFieldClass('directShopSale')} />
                            </div>
                        </div>
                    </div>

                    {/* Funnel Metrics Section (NEW) */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">Funnel Metrics</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1 font-medium">Visitor (Input)</label>
                                <input
                                    type="number"
                                    name="visitor"
                                    value={formData.visitor}
                                    onChange={handleChange}
                                    className={inputFieldClass('visitor')}
                                />
                                {fieldErrors.visitor && (
                                    <p className="text-red-500 text-xs mt-1">{fieldErrors.visitor}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1 font-medium">Customers (Input)</label>
                                <input
                                    type="number"
                                    name="customers"
                                    value={formData.customers}
                                    onChange={handleChange}
                                    className={inputFieldClass('customers')}
                                />
                                {fieldErrors.customers && (
                                    <p className="text-red-500 text-xs mt-1">{fieldErrors.customers}</p>
                                )}
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm text-gray-500 mb-1">Conversion Rate (Auto)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={conversionRate.toFixed(2)}
                                        disabled
                                        className={autoFieldClass('conversionRate')}
                                    />
                                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ================================ */}
                    {/* ADS SECTION - NEW STRUCTURE */}
                    {/* ================================ */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 md:col-span-2">
                        <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">Ads & Traffic</h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* GMV Ads Group */}
                            <div>
                                <label className="block text-sm text-gray-600 mb-1 font-medium">GMV Ads Spend (Input)</label>
                                <input
                                    type="number"
                                    name="gmvAdsSpend"
                                    value={formData.gmvAdsSpend}
                                    onChange={handleChange}
                                    className={inputFieldClass('gmvAdsSpend')}
                                />
                                {fieldErrors.gmvAdsSpend && (
                                    <p className="text-red-500 text-xs mt-1">{fieldErrors.gmvAdsSpend}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1 font-medium">GMV Live Ads Spend (Input)</label>
                                <input
                                    type="number"
                                    name="gmvLiveAdsSpend"
                                    value={formData.gmvLiveAdsSpend}
                                    onChange={handleChange}
                                    className={inputFieldClass('gmvLiveAdsSpend')}
                                />
                            </div>

                            {/* TTAM Group */}
                            <div>
                                <label className="block text-sm text-gray-600 mb-1 font-medium">TTAM Spend (Input)</label>
                                <input
                                    type="number"
                                    name="ttamSpendAds"
                                    value={formData.ttamSpendAds}
                                    onChange={handleChange}
                                    className={inputFieldClass('ttamSpendAds')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1 font-medium">TTAM Impressions (Input)</label>
                                <input
                                    type="number"
                                    name="ttamImpressions"
                                    value={formData.ttamImpressions}
                                    onChange={handleChange}
                                    className={inputFieldClass('ttamImpressions')}
                                />
                            </div>

                            {/* Auto-calculated fields */}
                            <div className="opacity-100">
                                <label className="block text-sm text-gray-500 mb-1">GMV Product Ads Spend (Auto)</label>
                                <input type="text" value={gmvProductAdsSpend.toFixed(2)} disabled className={autoFieldClass('gmvProductAdsSpend')} />
                            </div>
                            <div className="opacity-100">
                                <label className="block text-sm text-gray-500 mb-1">Total Ads Spend (Auto)</label>
                                <input type="text" value={totalAdsSpend.toFixed(2)} disabled className={autoFieldClass('totalAdsSpend')} />
                            </div>
                            <div className="opacity-100 col-span-2">
                                <label className="block text-sm text-gray-500 mb-1">CPM (Auto)</label>
                                <input type="text" value={cpm.toFixed(2)} disabled className={autoFieldClass('cpm')} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ROI Summary */}
                <div className="grid grid-cols-2 gap-8">
                    <div className={`bg-white p-6 rounded-xl border flex flex-col justify-center items-center transition-all duration-300 shadow-sm ${changedFields.has('roiTotal')
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : 'border-gray-200'
                        }`}>
                        <h4 className="text-gray-500 font-medium mb-1">ROI (Total)</h4>
                        <p className="text-4xl font-bold text-blue-600">{roiTotal.toFixed(2)}</p>
                    </div>
                    <div className={`bg-white p-6 rounded-xl border flex flex-col justify-center items-center transition-all duration-300 shadow-sm ${changedFields.has('roiGmv')
                        ? 'border-purple-500 ring-2 ring-purple-100'
                        : 'border-gray-200'
                        }`}>
                        <h4 className="text-gray-500 font-medium mb-1">ROI (GMV)</h4>
                        <p className="text-4xl font-bold text-purple-600">{roiGmv.toFixed(2)}</p>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={!isValid || isSubmitting}
                        className={`px-8 py-3 rounded-lg font-bold transition-all ${!isValid || isSubmitting
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-black text-white hover:bg-gray-800 shadow-lg'
                            }`}
                    >
                        {isSubmitting ? 'Saving...' : isEditMode ? 'Update Daily Record' : 'Save Daily Record'}
                    </button>
                </div>
            </form>

            {/* Enhanced Dark Theme Calendar Styles */}
            <style>{`
                .custom-popper {
                    z-index: 100 !important;
                }
                .custom-calendar {
                    background-color: #ffffff !important;
                    border: 1px solid #e5e7eb !important;
                    border-radius: 12px !important;
                    font-family: inherit !important;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
                    overflow: hidden;
                }
                .react-datepicker__header {
                    background-color: #f9fafb !important;
                    border-bottom: 1px solid #e5e7eb !important;
                    padding: 16px !important;
                }
                .react-datepicker__current-month {
                    color: #111827 !important;
                    font-size: 1.1rem !important;
                    font-weight: 600 !important;
                    margin-bottom: 8px !important;
                }
                .react-datepicker__day-name {
                    color: #6b7280 !important;
                    font-weight: 600 !important;
                }
                .react-datepicker__day {
                    color: #374151 !important;
                    border-radius: 8px !important;
                }
                .react-datepicker__day:hover {
                    background-color: #f3f4f6 !important;
                    color: #111827 !important;
                }
                .react-datepicker__day--today {
                    background-color: #f0fdf4 !important;
                    color: #15803d !important;
                    font-weight: 600 !important;
                }
                .react-datepicker__day--selected {
                    background-color: #111827 !important;
                    color: white !important;
                }
                .react-datepicker__day--disabled {
                    color: #d1d5db !important;
                    cursor: not-allowed !important;
                }
                .react-datepicker__day--disabled:hover {
                    background-color: transparent !important;
                }
                .react-datepicker__navigation-icon::before {
                    border-color: #6b7280 !important;
                }
                .react-datepicker__month-dropdown,
                .react-datepicker__year-dropdown {
                    background-color: #ffffff !important;
                    border: 1px solid #e5e7eb !important;
                }
                .react-datepicker__month-option,
                .react-datepicker__year-option {
                    color: #374151 !important;
                }
                .react-datepicker__month-option:hover,
                .react-datepicker__year-option:hover {
                    background-color: #f3f4f6 !important;
                }
                .react-datepicker__today-button {
                    background-color: #f9fafb !important;
                    color: #111827 !important;
                    border-top: 1px solid #e5e7eb !important;
                }
            `}</style>
        </div>
    );
};

export default DataEntry;
