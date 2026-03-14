import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const clearAuthState = (message = null) => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(message);
  };

  const handleUnauthorizedResponse = async (response, fallbackMessage = 'Your session has expired. Please sign in again.') => {
    if (response.status !== 401) {
      return false;
    }

    const data = await response.clone().json().catch(() => ({}));
    clearAuthState(data.message || fallbackMessage);
    return true;
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setIsLoadingAuth(false);
        return;
      }

      // Verify token with backend
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
        setIsAuthenticated(true);
      } else {
        await handleUnauthorizedResponse(response, 'Your session has expired. Please sign in again.');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      clearAuthState();
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password, role = null) => {
    try {
      setAuthError(null);
      
      const requestBody = { email, password };
      if (role) {
        requestBody.role = role;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('auth_token', data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        return { success: true, user: data.user };
      } else {
        const errorMessage = data.message || 'Login failed';
        setAuthError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthError(error.message);
      throw error;
    }
  };

  const register = async (email, password, fullName, role = 'student', rollNumber = '') => {
    try {
      setAuthError(null);
      
      const requestBody = { 
        email, 
        password, 
        fullName, 
        role 
      };
      
      // Add roll number for students
      if (role === 'student' && rollNumber) {
        requestBody.rollNumber = rollNumber;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return { success: true, user: data.user };
      } else {
        const errorMessage = data.message || 'Registration failed';
        setAuthError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setAuthError(error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      if (token) {
        // Notify backend of logout
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuthState();
    }
  };

  const navigateToLogin = () => {
    globalThis.location.href = '/login';
  };

  // Helper function to get auth headers for API calls
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    } : {
      'Content-Type': 'application/json'
    };
  };

  // Helper function to check if user has specific role
  const hasRole = (requiredRole) => {
    if (!user || !isAuthenticated) return false;
    if (user.role === 'admin') return true; // Admin has access to everything
    return user.role === requiredRole;
  };

  // Helper function to check if user has any of the required roles
  const hasAnyRole = (requiredRoles) => {
    if (!user || !isAuthenticated) return false;
    if (user.role === 'admin') return true; // Admin has access to everything
    return requiredRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      authError,
      login,
      register,
      logout,
      clearAuthState,
      handleUnauthorizedResponse,
      navigateToLogin,
      getAuthHeaders,
      hasRole,
      hasAnyRole,
      checkAuthStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;