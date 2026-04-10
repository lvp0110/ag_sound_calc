import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Calculator from './components/Calculator';
import ItemInfo from './components/ItemInfo';
import KpPage from './components/KpPage';
import PricePage from './components/PricePage';

// Определяем basename для GitHub Pages
// В production используем base path из Vite, в dev - пустая строка
const basename = import.meta.env.BASE_URL || '/';

function App() {
  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/" element={<Navigate to="/calc" replace />} />
        <Route element={<AppLayout />}>
          <Route path="/calc/:id?" element={<Calculator />} />
          <Route path="/kp" element={<KpPage />} />
          <Route path="/price" element={<PricePage />} />
          <Route path="/info/:id" element={<ItemInfo />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
