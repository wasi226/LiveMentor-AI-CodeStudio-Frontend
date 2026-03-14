/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Landing from './src/pages/Landing';
import Login from './src/pages/Login';
import Register from './src/pages/Register';
import RoleSelection from './src/pages/RoleSelection';
import Analytics from './src/pages/Analytics';
import Classroom from './src/pages/Classroom';
import FacultyDashboard from './src/pages/FacultyDashboard';
import StudentDashboard from './src/pages/StudentDashboard';
import TestPage from './src/pages/TestPage';
import __Layout from './layout.jsx';

export const PAGES = {
  "Landing": Landing,
  "Login": Login,
  "Register": Register,
  "RoleSelection": RoleSelection,
  "Analytics": Analytics,  
  "Classroom": Classroom,
  "FacultyDashboard": FacultyDashboard,
  "StudentDashboard": StudentDashboard,
  "TestPage": TestPage,
};

export const pagesConfig = {
  mainPage: "Landing",
  Pages: PAGES,
  Layout: __Layout,
};