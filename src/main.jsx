import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Apply dark class based on stored preference or system
const applyTheme = () => {
  const pref = localStorage.getItem('theme') || 'auto';
  if (pref === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (pref === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};
applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!localStorage.getItem('theme') || localStorage.getItem('theme') === 'auto') applyTheme();
});
window.addEventListener('themechange', applyTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Register Service Worker for offline app shell caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Pede ao sistema para marcar o armazenamento como persistente, para que o
// Android não descarte a app shell nem a fila de registos offline quando o
// espaço apertar. Silencioso: se o pedido for recusado, nada acontece.
if (navigator.storage?.persist) {
  navigator.storage.persisted()
    .then((already) => (already ? true : navigator.storage.persist()))
    .catch(() => {});
}