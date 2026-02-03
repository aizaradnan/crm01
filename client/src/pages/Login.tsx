import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/login', { username, password });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            navigate('/');
        } catch (err) {
            setError('Invalid credentials');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-xl border border-gray-200 w-96 shadow-xl">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">Admin Login</h2>
                {error && <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded mb-4 text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1 font-medium">Username</label>
                        <input
                            value={username} onChange={e => setUsername(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded p-2 focus:border-black outline-none text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1 font-medium">Password</label>
                        <input
                            type="password"
                            value={password} onChange={e => setPassword(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded p-2 focus:border-black outline-none text-gray-900"
                        />
                    </div>
                    <button type="submit" className="w-full bg-black text-white font-bold py-2 rounded hover:bg-gray-800 transition shadow-md">
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};
export default Login;
