import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './pwa/registerSw'

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Register PWA service worker (production only, guarded against preview/iframe)
registerServiceWorker();
