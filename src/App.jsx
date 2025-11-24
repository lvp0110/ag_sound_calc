import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Calculator from './components/Calculator';
import './App.css';

function App() {
  // Для GitHub Pages: используйте basename равный имени репозитория
  // Для локальной разработки basename будет '/'
  const basename = import.meta.env.PROD ? '/sound_calc' : '';

  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/calc/:id?" element={<Calculator />} />
        <Route path="/" element={<Navigate to="/calc" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
