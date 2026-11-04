import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

// Remove the boot splash once the first paint has happened.
requestAnimationFrame(() => {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.style.opacity = '0';
  window.setTimeout(() => boot.remove(), 450);
});

// Offline-first service worker (production only keeps HMR clean in dev).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}
