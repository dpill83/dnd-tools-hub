import '../../../global.css';
import './layout.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WaterdeepTrader from './WaterdeepTrader.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WaterdeepTrader />
  </StrictMode>
);
