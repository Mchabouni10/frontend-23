// src/App.js
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getUser, bootstrapSession, subscribeAuth } from './utilities/users-service';
import { ErrorProvider } from './context/ErrorContext';
import { WorkTypeProvider } from './context/WorkTypeContext';
import { WorkTypeTaxonomyProvider } from './context/WorkTypeTaxonomyContext';
import ErrorBoundaryWrapper from './components/ErrorBoundary';
import { syncOfflineProjects } from './services/offlineSyncService';
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
import ProjectCalendar from './components/Calendar/ProjectCalendar';

export default function App() {
  const [user, setUser] = useState(getUser());
  const [sessionReady, setSessionReady] = useState(() => !getUser());
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

  useEffect(() => {
    return subscribeAuth((nextUser, meta) => {
      setUser(nextUser);
      if (!nextUser && meta?.reason === 'expired') {
        toast.info('Your session expired. Please sign in again.');
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextUser = await bootstrapSession();
      if (cancelled) return;
      setUser(nextUser);
      setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const handleOnline = () => {
      console.log('App is online. Attempting to sync offline projects...');
      syncOfflineProjects();
    };

    window.addEventListener('online', handleOnline);

    if (navigator.onLine) {
      syncOfflineProjects();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [user]);

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

          <ErrorBoundaryWrapper boundaryName="AppRoot">
            {!sessionReady ? (
              <div className="mainContent" style={{ display: 'flex', justifyContent: 'center', paddingTop: '20vh' }}>
                <p>Checking session…</p>
              </div>
            ) : user ? (
              // FIX: WorkTypeTaxonomyProvider is now INSIDE the auth check.
              // Previously it wrapped the entire app, so it mounted before login
              // and fired the fetch with no token — got a 401, hasFetched was
              // already true, and the taxonomy stayed empty for the whole session.
              // Now it only mounts (and fetches) when the user is authenticated.
              <WorkTypeTaxonomyProvider>
                <WorkTypeProvider>
                  <>
                  <Navbar
                    user={user}
                    setUser={setUser}
                    toggleDarkMode={toggleDarkMode}
                    isDarkMode={isDarkMode}
                  />
                  <main className="mainContent">
                    <ErrorBoundaryWrapper boundaryName="MainContent">
                      <Routes>
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

                        <Route path="/home/sketch" element={
                          <ErrorBoundaryWrapper boundaryName="FloorPlanDesigner">
                            <FloorPlanDesigner />
                          </ErrorBoundaryWrapper>
                        } />

                        <Route path="/home/print/:id" element={
                          <ErrorBoundaryWrapper boundaryName="EstimateSummary">
                            <EstimateSummaryPage />
                          </ErrorBoundaryWrapper>
                        } />

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
                        <Route path="/home/calendar" element={
                          <ErrorBoundaryWrapper boundaryName="ProjectCalendar">
                            <ProjectCalendar />
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
              </WorkTypeProvider>
            </WorkTypeTaxonomyProvider>
          ) : (
              <ErrorBoundaryWrapper boundaryName="AuthPage">
                <AuthPage
                  setUser={setUser}
                  toggleDarkMode={toggleDarkMode}
                  isDarkMode={isDarkMode}
                />
              </ErrorBoundaryWrapper>
            )}
          </ErrorBoundaryWrapper>
        </div>
    </ErrorProvider>
  );
}