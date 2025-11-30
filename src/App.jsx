import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Calculator from './components/Calculator';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/calc/:id?" element={<Calculator />} />
        <Route path="/" element={<Navigate to="/calc" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
