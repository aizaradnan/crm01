import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
    startDate: Date | null;
    endDate: Date | null;
    onChange: (dates: [Date | null, Date | null]) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
    // Helper to format Date to YYYY-MM-DD for input[type="date"]
    const formatDate = (date: Date | null) => {
        if (!date) return '';
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    const [startStr, setStartStr] = useState(formatDate(startDate));
    const [endStr, setEndStr] = useState(formatDate(endDate));

    useEffect(() => {
        setStartStr(formatDate(startDate));
        setEndStr(formatDate(endDate));
    }, [startDate, endDate]);

    const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setStartStr(val);
        if (val && endStr) {
            onChange([new Date(val), new Date(endStr)]);
        } else if (val) {
            onChange([new Date(val), null]);
        }
    };

    const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setEndStr(val);
        if (startStr && val) {
            onChange([new Date(startStr), new Date(val)]);
        }
    };

    const presets = [
        { label: 'Custom', value: 'custom' },
        { label: 'Today', value: 'today' },
        { label: 'Yesterday', value: 'yesterday' },
        { label: 'Last 7 Days', value: 'last7' },
        { label: 'Last 30 Days', value: 'last30' },
        { label: 'This Month', value: 'thisMonth' },
        { label: 'Last Month', value: 'lastMonth' },
        { label: 'Last 3 Months', value: 'last3Months' },
    ];

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize to start of day for consistent calculations
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        let newStart: Date | null = null;
        let newEnd: Date | null = endOfDay;

        switch (value) {
            case 'today':
                newStart = now;
                break;
            case 'yesterday':
                const yest = new Date(now);
                yest.setDate(yest.getDate() - 1);
                newStart = yest;
                newEnd = new Date(yest);
                newEnd.setHours(23, 59, 59, 999);
                break;
            case 'last7':
                newStart = new Date(now);
                newStart.setDate(newStart.getDate() - 6);
                break;
            case 'last30':
                newStart = new Date(now);
                newStart.setDate(newStart.getDate() - 29);
                break;
            case 'thisMonth':
                newStart = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'lastMonth':
                newStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                newEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                newEnd.setHours(23, 59, 59, 999);
                break;
            case 'last3Months':
                newStart = new Date(now);
                newStart.setDate(newStart.getDate() - 89);
                break;
            default:
                return; // Custom logic, do nothing to dates
        }

        if (newStart && newEnd) {
            onChange([newStart, newEnd]);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center px-2 text-gray-500">
                <Calendar size={18} />
            </div>

            {/* Preset Selector */}
            <select
                className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer hover:bg-gray-50 p-2 rounded-lg border-r border-gray-100 pr-8"
                onChange={handlePresetChange}
                defaultValue="custom"
            >
                {presets.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                ))}
            </select>

            {/* Native Date Inputs */}
            <div className="flex items-center gap-2 px-2">
                <input
                    type="date"
                    value={startStr}
                    onChange={handleStartChange}
                    className="text-sm font-sans text-gray-700 focus:outline-none p-1 rounded hover:bg-gray-50"
                />
                <span className="text-gray-400">-</span>
                <input
                    type="date"
                    value={endStr}
                    onChange={handleEndChange}
                    className="text-sm font-sans text-gray-700 focus:outline-none p-1 rounded hover:bg-gray-50"
                />
            </div>
        </div>
    );
};

export default DateRangePicker;
