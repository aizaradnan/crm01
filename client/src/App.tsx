import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MonthlyData from './pages/MonthlyData';
import DataEntry from './pages/DataEntry';
import AutoAnalysis from './pages/AutoAnalysis';
import PricingLab from './pages/PricingLab';
import Layout from './components/Layout';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/monthly" element={<ProtectedRoute><MonthlyData /></ProtectedRoute>} />
        <Route path="/auto-analysis" element={<ProtectedRoute><AutoAnalysis /></ProtectedRoute>} />
        <Route path="/pricing-lab" element={<ProtectedRoute><PricingLab /></ProtectedRoute>} />
        <Route path="/entry" element={<ProtectedRoute><DataEntry /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
