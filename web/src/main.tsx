import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Home from './pages/Home';
import Briefing from './pages/Briefing';
import Signals from './pages/Signals';
import Outlook from './pages/Outlook';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/briefing" element={<Briefing />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/outlook" element={<Outlook />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
