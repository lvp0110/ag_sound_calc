import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Calculator from './components/Calculator';
import ItemInfo from './components/ItemInfo';
import KpPage from './components/KpPage';

// Определяем basename для GitHub Pages
// В production используем base path из Vite, в dev - пустая строка
const basename = import.meta.env.BASE_URL || '/';

function App() {
  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/calc/:id?" element={<Calculator />} />
        <Route path="/kp" element={<KpPage />} />
        <Route path="/info/:id" element={<ItemInfo />} />
        <Route path="/" element={<Navigate to="/calc" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
