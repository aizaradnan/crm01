import React, { useEffect, useState } from 'react';
import { Home, List, PlusSquare, LogOut, Calculator } from 'lucide-react';
import clsx from 'clsx';
import { Link, useLocation } from 'react-router-dom';

interface User {
    id: number;
    username: string;
    role: 'ADMIN' | 'CLIENT';
}

const Layout = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const location = useLocation();

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (u) setUser(JSON.parse(u));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    const navItems = [
        { label: 'Dashboard', icon: Home, href: '/' },
        { label: 'Monthly Data', icon: List, href: '/monthly' },
        { label: 'Auto Analysis', icon: PlusSquare, href: '/auto-analysis' },
        { label: 'Pricing Lab', icon: Calculator, href: '/pricing-lab' },
        { label: 'Data Entry', icon: PlusSquare, href: '/entry', adminOnly: true },
    ];

    return (
        <div className="flex min-h-screen bg-gray-50 text-gray-900">
            {/* Sidebar */}
            <aside className="w-64 border-r border-gray-200 bg-white p-6 flex flex-col shadow-sm">
                <h1 className="text-2xl font-bold mb-8 text-gray-900 tracking-tight">
                    Reporting 2.0
                </h1>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                        (!item.adminOnly || user?.role === 'ADMIN') && (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={clsx(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                                    location.pathname === item.href
                                        ? "bg-black text-white shadow-md"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                                )}
                            >
                                <item.icon size={20} />
                                <span className="">{item.label}</span>
                            </Link>
                        )
                    ))}
                </nav>

                <div className="pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">{user?.username || 'Guest'}</p>
                            <p className="text-xs text-gray-500">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 w-full transition-colors px-1"
                    >
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
};

export default Layout;
