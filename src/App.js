// src/App.js
import './App.css';
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getUser } from './utilities/users-service';
import { ErrorProvider } from './context/ErrorContext';
import ErrorBoundaryWrapper from './components/ErrorBoundary';
import Navbar from './components/Navbar/Navbar';
import AuthPage from './components/AuthPage/AuthPage';
import UserLogOut from './components/UserLogOut/UserLogOut';
import HomePage from './components/HomePage/HomePage';
import CustomersList from './components/CustomersList/CustomersList';
import CustomerProjects from './components/CustomerProjects/CustomerProjects';
import EstimateSummaryPage from './components/EstimateSummary/EstimateSummary';
import FinanceDashboard from './components/FinanceDashboard/FinanceDashboard';
import FloorPlanDesigner from './components/SketchPad/FloorPlanDesigner';
import CompanyExpenses from './components/CompanyExpenses/CompanyExpenses';

export default function App() {
  const [user, setUser] = useState(getUser());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode === 'true' || (!savedMode && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const htmlElement = document.documentElement;
    if (isDarkMode) {
      htmlElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      htmlElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prevMode) => !prevMode);
  };

  return (
    <ErrorProvider>
      <div className="App">
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
        <div className="backgroundEffects"></div>

        {/* Top-level error boundary for critical app structure */}
        <ErrorBoundaryWrapper boundaryName="AppRoot">
          {user ? (
            <>
              <Navbar
                user={user}
                setUser={setUser}
                toggleDarkMode={toggleDarkMode}
                isDarkMode={isDarkMode}
              />
              <main className="mainContent">
                {/* Separate boundary for main content */}
                <ErrorBoundaryWrapper boundaryName="MainContent">
                  <Routes>
                    {/* HomePage gets its own boundary since it's complex */}
                    <Route path="/home/customer" element={
                      <ErrorBoundaryWrapper boundaryName="HomePage">
                        <HomePage />
                      </ErrorBoundaryWrapper>
                    } />
                    <Route path="/home/customer/:id" element={
                      <ErrorBoundaryWrapper boundaryName="HomePageDetail">
                        <HomePage />
                      </ErrorBoundaryWrapper>
                    } />
                    <Route path="/home/edit/:id" element={
                      <ErrorBoundaryWrapper boundaryName="HomePageEdit">
                        <HomePage />
                      </ErrorBoundaryWrapper>
                    } />

                    {/* Sketch Designer Route - UPDATED */}
                    <Route path="/home/sketch" element={
                      <ErrorBoundaryWrapper boundaryName="FloorPlanDesigner">
                        <FloorPlanDesigner />
                      </ErrorBoundaryWrapper>
                    } />

                    {/* Print/Estimate route */}
                    <Route path="/home/print/:id" element={
                      <ErrorBoundaryWrapper boundaryName="EstimateSummary">
                        <EstimateSummaryPage />
                      </ErrorBoundaryWrapper>
                    } />

                    {/* Other routes with appropriate boundaries */}
                    <Route path="/home/customers" element={
                      <ErrorBoundaryWrapper boundaryName="CustomersList">
                        <CustomersList />
                      </ErrorBoundaryWrapper>
                    } />
                    <Route path="/home/customer-projects" element={
                      <ErrorBoundaryWrapper boundaryName="CustomerProjects">
                        <CustomerProjects />
                      </ErrorBoundaryWrapper>
                    } />
                    <Route path="/home/new-customer-project" element={
                      <ErrorBoundaryWrapper boundaryName="NewProject">
                        <HomePage />
                      </ErrorBoundaryWrapper>
                    } />
                    <Route path="/home/finance" element={
                      <ErrorBoundaryWrapper boundaryName="FinanceDashboard">
                        <FinanceDashboard />
                      </ErrorBoundaryWrapper>
                    } />
                    <Route path="/home/company-expenses" element={
                      <ErrorBoundaryWrapper boundaryName="CompanyExpenses">
                        <CompanyExpenses />
                      </ErrorBoundaryWrapper>
                    } />
                    <Route path="/logout" element={
                      <ErrorBoundaryWrapper boundaryName="Logout">
                        <UserLogOut user={user} setUser={setUser} />
                      </ErrorBoundaryWrapper>
                    } />
                    <Route path="/" element={<Navigate to="/home/customers" />} />
                  </Routes>
                </ErrorBoundaryWrapper>
              </main>
            </>
          ) : (
            <>
              {/* Auth page gets its own boundary */}
              <ErrorBoundaryWrapper boundaryName="AuthPage">
                <AuthPage
                  setUser={setUser}
                  toggleDarkMode={toggleDarkMode}
                  isDarkMode={isDarkMode}
                />
              </ErrorBoundaryWrapper>
            </>
          )}
        </ErrorBoundaryWrapper>
      </div>
    </ErrorProvider>
  );
}