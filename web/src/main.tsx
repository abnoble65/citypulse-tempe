import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Home from './pages/Home';
import Briefing from './pages/Briefing';
import Charts from './pages/Charts';
import Signals from './pages/Signals';
import Outlook from './pages/Outlook';
import Commission from './pages/Commission';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/briefing" element={<Briefing />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/outlook" element={<Outlook />} />
        <Route path="/commission" element={<Commission />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
