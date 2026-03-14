import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, LogIn, ArrowLeft, Users, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';

const Login = () => {
  const [selectedRole, setSelectedRole] = useState(localStorage.getItem('selectedRole') || 'student');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Get selected role from localStorage
    const role = localStorage.getItem('selectedRole');
    if (role) {
      setSelectedRole(role);
    }
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password, selectedRole);
      if (result.success) {
        // Clear the selected role from localStorage
        localStorage.removeItem('selectedRole');
        
        // Redirect based on user role
        const userRole = result.user.role;
        if (userRole === 'faculty') {
          navigate('/faculty-dashboard');
        } else if (userRole === 'student') {
          navigate('/student-dashboard');
        } else {
          navigate('/analytics');
        }
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-2xl border border-slate-800 bg-slate-900">
          <CardHeader className="text-center pb-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4"
            >
              <LogIn className="w-8 h-8 text-white" />
            </motion.div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-slate-400">
              Sign in to liveMentor AI CodeStudio
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Role Display */}
            <div className="flex items-center justify-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
              {selectedRole === 'faculty' ? (
                <>
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="font-medium text-slate-300">Logging in as Faculty</span>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
                    Faculty
                  </Badge>
                </>
              ) : (
                <>
                  <GraduationCap className="w-5 h-5 text-purple-400" />
                  <span className="font-medium text-slate-300">Logging in as Student</span>
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">
                    Student
                  </Badge>
                </>
              )}
            </div>

            {error && (
              <Alert className="border-red-800 bg-red-900/50">
                <AlertDescription className="text-red-300">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    className="pl-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="pl-10 pr-12 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="text-center space-y-4">
              <div className="text-sm text-slate-400">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Create account
                </Link>
              </div>

              <div className="text-sm">
                <Link
                  to="/role-selection"
                  className="font-medium text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Wrong role? Change here
                </Link>
              </div>
              
              <Link
                to="/"
                className="inline-flex items-center space-x-2 text-slate-400 hover:text-slate-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to home</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Login;