import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import SchedulePage from './pages/SchedulePage';
import TaskPage from './pages/TaskPage';
import InventoryPage from './pages/InventoryPage';
import RegisterPage from './pages/RegisterPage';
import DetailPage from './pages/DetailPage';
import VtonPage from './pages/VtonPage';
import { useAppStore } from './store/useAppStore';
import './App.css';

function App() {
  const initApp = useAppStore(state => state.initApp);

  useEffect(() => {
    initApp();
  }, [initApp]);

  return (
    <Router>
      <Navigation />
      <Routes>
        <Route path="/" element={<main className="main-content"><SchedulePage /></main>} />
        <Route path="/task" element={<main className="main-content"><TaskPage /></main>} />
        <Route path="/inventory" element={<main className="main-content"><InventoryPage /></main>} />
        <Route path="/register" element={<main className="main-content"><RegisterPage /></main>} />
        <Route path="/detail/:id" element={<main className="main-content"><DetailPage /></main>} />
        <Route path="/vton" element={<main style={{width: '100%', padding: '0 20px'}}><VtonPage /></main>} />
      </Routes>
    </Router>
  );
}

export default App;
