import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// StrictMode removed: react-konva's internal reconciler
// conflicts with React 19 StrictMode double-rendering.
createRoot(document.getElementById('root')!).render(<App />);
