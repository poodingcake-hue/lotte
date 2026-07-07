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
      <main className="main-content">
        <Routes>
          <Route path="/" element={<SchedulePage />} />
          <Route path="/task" element={<TaskPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/detail/:id" element={<DetailPage />} />
          <Route path="/vton" element={<VtonPage />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
