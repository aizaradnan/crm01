import React, { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
    startDate: Date | null;
    endDate: Date | null;
    onChange: (dates: [Date | null, Date | null]) => void;
}

// Custom Input Component
const CustomInput = forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => (
        <button
            ref={ref}
            onClick={onClick}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm group min-w-[260px] justify-between"
        >
            <div className="flex items-center gap-2 text-gray-700 group-hover:text-gray-900">
                <Calendar size={18} className="text-gray-400 group-hover:text-gray-600" />
                <span className="font-medium text-sm">{value || "Select Date Range"}</span>
            </div>
            <ChevronDown size={16} className="text-gray-400" />
        </button>
    )
);

const CalendarPortal = ({ children }: { children?: React.ReactNode }) => {
    return createPortal(children, document.body);
};

const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
    // Preset definitions
    const presets = [
        {
            label: 'Today',
            getRange: () => {
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                const start = new Date(today);
                start.setHours(0, 0, 0, 0);
                return [start, today];
            }
        },
        {
            label: 'Yesterday',
            getRange: () => {
                const end = new Date();
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                const start = new Date(end);
                start.setHours(0, 0, 0, 0);
                return [start, end];
            }
        },
        {
            label: 'Last 7 Days',
            getRange: () => {
                const end = new Date();
                end.setHours(23, 59, 59, 999);
                const start = new Date(end);
                start.setDate(start.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                return [start, end];
            }
        },
        {
            label: 'Last 30 Days',
            getRange: () => {
                const end = new Date();
                end.setHours(23, 59, 59, 999);
                const start = new Date(end);
                start.setDate(start.getDate() - 29);
                start.setHours(0, 0, 0, 0);
                return [start, end];
            }
        },
        {
            label: 'This Month',
            getRange: () => {
                const end = new Date();
                end.setHours(23, 59, 59, 999);
                const start = new Date(end.getFullYear(), end.getMonth(), 1);
                return [start, end];
            }
        },
        {
            label: 'Last Month',
            getRange: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const end = new Date(now.getFullYear(), now.getMonth(), 0);
                end.setHours(23, 59, 59, 999);
                return [start, end];
            }
        },
        {
            label: 'Last 3 Months',
            getRange: () => {
                const end = new Date();
                end.setHours(23, 59, 59, 999);
                const start = new Date(end);
                start.setMonth(start.getMonth() - 2); // Current + 2 prev
                start.setDate(1); // Approximate, usually people want "90 days" or "3 calendar months"? Let's stick to 90 days for consistency or calendar months.
                // Let's do 90 days for "Last 3 Months" in analytics context usually means last 90 days.
                // Or "Last 3 Calendar Months".
                // Let's go with generic rolling 90 days
                start.setDate(end.getDate() - 89);
                start.setHours(0, 0, 0, 0);
                return [start, end];
            }
        }
    ];

    const handlePresetClick = (getRange: () => Date[]) => {
        const [start, end] = getRange();
        onChange([start, end]);
    };

    // Custom Container to hold Sidebar + Calendar
    const CalendarContainer = ({ children }: any) => {
        return (
            <div
                className="flex bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden font-sans"
                style={{ display: 'flex', flexDirection: 'row', minWidth: '700px' }}
            >
                {/* Sidebar Presets - DIRECTLY VISIBLE */}
                <div className="flex-none w-48 bg-gray-50 border-r border-gray-200 p-3 flex flex-col gap-2 h-auto relative z-20">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Presets
                    </div>
                    {presets.map((preset) => (
                        <button
                            key={preset.label}
                            onClick={() => handlePresetClick(preset.getRange)}
                            className="text-left px-3 py-2 text-sm text-gray-700 hover:bg-white hover:text-black rounded-md transition-colors font-medium border border-transparent hover:border-gray-200 hover:shadow-sm whitespace-nowrap"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                {/* Main Calendar Area */}
                <div className="flex-grow p-4 relative z-10 bg-white">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Malaysia Time (GMT+8)
                        </span>
                    </div>
                    {/* Ensure children (the calendar) take full width but respect flex */}
                    <div className="relative w-full">
                        {/* We modify the className passed in to avoid double styling if needed, or just wrap it */}
                        <div style={{ width: '100%' }}>
                            {children}
                        </div>
                    </div>
                </div>

                {/* Global styles specifically for this widget */}
                <style>{`
                    /* Override react-datepicker base class to behave like a normal block */
                    .react-datepicker {
                        display: block !important;
                        width: 100% !important;
                        border: none !important;
                    }
                    .react-datepicker__month-container {
                        width: 100% !important;
                        float: none !important;
                    }
                    .react-datepicker__header {
                        padding-top: 0 !important;
                        background: white !important;
                        border: none !important;
                    }
                    /* Ensure days are spaced */
                    .react-datepicker__day-name, .react-datepicker__day {
                        width: 2.5rem !important;
                        line-height: 2.5rem !important;
                        margin: 0.2rem !important;
                    }
                    /* Hide navigation if it conflicts, or style it */
                    .react-datepicker__navigation {
                        top: 0px !important;
                    }
                    .react-datepicker-popper {
                        z-index: 999999 !important;
                        position: fixed !important;
                    }
                `}</style>
            </div>
        );
    };

    return (
        <div className="relative z-50">
            <DatePicker
                selected={startDate}
                onChange={onChange}
                startDate={startDate}
                endDate={endDate}
                selectsRange
                monthsShown={1} // Keep it simple for now, can extend to 2
                maxDate={new Date()}
                customInput={<CustomInput />}
                calendarContainer={CalendarContainer}
                dateFormat="MMM d, yyyy"
                popperContainer={CalendarPortal}
                popperProps={{
                    strategy: 'fixed'
                }}
                shouldCloseOnSelect={true}
            />
        </div>
    );
};

export default DateRangePicker;
