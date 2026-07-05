import React from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import AuditDashboard from './components/AuditDashboard.jsx';

createRoot(document.getElementById('root')).render(<AuditDashboard />);
