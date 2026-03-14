import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Users, BookOpen, User, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';

const RoleSelection = () => {
  const navigate = useNavigate();

  const handleRoleSelection = (role) => {
    // Store selected role in localStorage for the login/register process
    localStorage.setItem('selectedRole', role);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Back to Home */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-slate-400 hover:text-slate-300 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </div>

        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-slate-100 mb-4">
            Choose Your Role
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Select how you'll be using liveMentor AI CodeStudio to get started with the right experience
          </p>
        </motion.div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Faculty Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -5 }}
            className="cursor-pointer"
            onClick={() => handleRoleSelection('faculty')}
          >
            <Card className="h-full border-2 border-slate-800 hover:border-blue-500 hover:shadow-xl transition-all duration-300 bg-slate-900">
              <CardHeader className="text-center pb-6">
                <div className="mx-auto mb-4 p-4 bg-blue-500/20 rounded-full w-20 h-20 flex items-center justify-center">
                  <User className="h-10 w-10 text-blue-400" />
                </div>
                <CardTitle className="text-2xl font-bold text-slate-100">
                  Faculty / Instructor
                </CardTitle>
                <CardDescription className="text-slate-400 text-lg mt-2">
                  Teach, manage classrooms, and track student progress
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Create and manage virtual classrooms</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Monitor student activities in real-time</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <GraduationCap className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Generate class codes for easy enrollment</span>
                  </div>
                </div>
                <div className="pt-4">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3">
                    Continue as Faculty
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Student Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -5 }}
            className="cursor-pointer"
            onClick={() => handleRoleSelection('student')}
          >
            <Card className="h-full border-2 border-slate-800 hover:border-purple-500 hover:shadow-xl transition-all duration-300 bg-slate-900">
              <CardHeader className="text-center pb-6">
                <div className="mx-auto mb-4 p-4 bg-purple-500/20 rounded-full w-20 h-20 flex items-center justify-center">
                  <GraduationCap className="h-10 w-10 text-purple-400" />
                </div>
                <CardTitle className="text-2xl font-bold text-slate-100">
                  Student
                </CardTitle>
                <CardDescription className="text-slate-400 text-lg mt-2">
                  Learn, code, and collaborate with classmates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Join classes using invitation codes</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Collaborate with AI tutor and peers</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <GraduationCap className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Track your learning progress</span>
                  </div>
                </div>
                <div className="pt-4">
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3">
                    Continue as Student
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-12"
        >
          <p className="text-slate-400">
            Not sure which role to choose? Students join classes, Faculty create and manage them.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RoleSelection;