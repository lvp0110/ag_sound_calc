import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Calculator from './components/Calculator';
import ItemInfo from './components/ItemInfo';
import KpList from './components/KpList';
import KpPage from './components/KpPage';
import LoginModal from './components/LoginModal';
import PricePage from './components/PricePage';
import RegisterPage from './components/RegisterPage';
import { AuthProvider } from './context/AuthContext.jsx';

// Определяем basename для GitHub Pages
// В production используем base path из Vite, в dev - пустая строка
const basename = import.meta.env.BASE_URL || '/';

function App() {
  return (
    <Router basename={basename}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/calc" replace />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<AppLayout />}>
            <Route path="/calc/:id?" element={<Calculator />} />
            <Route path="/kp/list" element={<KpList />} />
            <Route path="/kp/:id" element={<KpPage />} />
            <Route path="/price" element={<PricePage />} />
            <Route path="/info/:id" element={<ItemInfo />} />
          </Route>
        </Routes>
        <LoginModal />
      </AuthProvider>
    </Router>
  );
}

export default App;
