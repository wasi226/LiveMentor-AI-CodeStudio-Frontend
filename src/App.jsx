import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from '../pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { CollaborationProvider } from '@/contexts/CollaborationContext';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated and not on login/register pages, show landing page
  const currentPath = window.location.pathname;
  const publicPages = ['/', '/login', '/register', '/role-selection'];
  
  if (!isAuthenticated && !publicPages.includes(currentPath)) {
    window.location.href = '/role-selection';
    return null;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      <Route path="/login" element={<Pages.Login />} />
      <Route path="/register" element={<Pages.Register />} />
      <Route path="/role-selection" element={<Pages.RoleSelection />} />
      <Route path="/analytics" element={<Pages.Analytics />} />
      <Route path="/classroom" element={<Pages.Classroom />} />
      <Route path="/faculty-dashboard" element={<Pages.FacultyDashboard />} />
      <Route path="/student-dashboard" element={<Pages.StudentDashboard />} />
      <Route path="/test" element={<Pages.TestPage />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <CollaborationProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
        </CollaborationProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
