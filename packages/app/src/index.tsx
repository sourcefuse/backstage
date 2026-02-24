import '@backstage/cli/asset-types';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill crypto.randomUUID for non-secure (HTTP) contexts
if (typeof window !== 'undefined' && window.crypto && !window.crypto.randomUUID) {
  window.crypto.randomUUID = function (): `${string}-${string}-${string}-${string}-${string}` {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10).join('')}` as `${string}-${string}-${string}-${string}-${string}`;
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />); //NOSONAR
