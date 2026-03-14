/**
 * Student Performance Dashboard
 * Displays comprehensive performance analytics, skill heatmap,
 * and categorization with early warning system
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import performanceAnalytics, { PERFORMANCE_CATEGORIES, PROGRAMMING_CONCEPTS } from '@/services/performanceAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Award, 
  Target, 
  Brain,
  Clock,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export default function StudentPerformanceDashboard({ classroomId, studentEmail = null, viewMode = 'student' }) {
  const [selectedStudent, setSelectedStudent] = useState(studentEmail);
  const [refreshing, setRefreshing] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [classroomData, setClassroomData] = useState(null);

  // Get current user for permission checks
  const { data: currentUser } = useQuery({ 
    queryKey: ['currentUser'], 
    queryFn: () => Promise.resolve({ email: 'user@example.com', name: 'User' })
  });

  // Get classroom data
  const { data: classroom } = useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: async () => {
      // Mock classroom data
      return null;
    },
    enabled: !!classroomId,
  });

  // Determine if current user is faculty
  const isFaculty = currentUser && classroom && classroom.faculty_email === currentUser.email;

  // Load performance analytics
  useEffect(() => {
    if (classroomId) {
      loadPerformanceData();
    }
  }, [classroomId, selectedStudent]);

  const loadPerformanceData = async () => {
    setRefreshing(true);
    try {
      if (viewMode === 'classroom' && isFaculty) {
        // Load classroom-wide analytics for faculty
        const data = await performanceAnalytics.analyzeClassroomPerformance(classroomId);
        setClassroomData(data);
      } else {
        // Load individual student analytics
        const targetStudent = selectedStudent || currentUser?.email;
        if (targetStudent) {
          const data = await performanceAnalytics.analyzeStudentPerformance(targetStudent, classroomId);
          setPerformanceData(data);
        }
      }
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const PerformanceBadge = ({ category }) => (
    <Badge 
      style={{ 
        backgroundColor: `${category.color}20`,
        color: category.color,
        border: `1px solid ${category.color}40`
      }}
      className="px-3 py-1 text-sm font-medium"
    >
      {category.label}
    </Badge>
  );

  const SkillHeatmap = ({ conceptSkills }) => {
    const heatmapData = performanceAnalytics.generateSkillHeatmap(conceptSkills);
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {heatmapData.map((skill) => (
          <div
            key={skill.concept}
            className="p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800/70 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-slate-300 truncate">
                {skill.concept}
              </h4>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: skill.color }}
                title={`${skill.proficiency.toFixed(1)}% proficiency`}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Score:</span>
                <span className="text-white font-mono">
                  {skill.proficiency.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Attempts:</span>
                <span className="text-slate-400">{skill.attempts}</span>
              </div>
              {skill.lastPracticed && (
                <div className="text-xs text-slate-500 mt-1">
                  Last: {new Date(skill.lastPracticed).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const WarningAlerts = ({ warnings }) => {
    if (!warnings || warnings.length === 0) return null;

    return (
      <div className="space-y-2">
        {warnings.map((warning, index) => (
          <Alert 
            key={index}
            className={`border ${
              warning.severity === 'high' ? 'border-red-500/50 bg-red-500/10' :
              warning.severity === 'medium' ? 'border-orange-500/50 bg-orange-500/10' :
              'border-blue-500/50 bg-blue-500/10'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm font-medium">
              {warning.type.replace(/_/g, ' ')} Alert
            </AlertTitle>
            <AlertDescription className="text-sm">
              {warning.message}
              <div className="mt-2 text-xs opacity-80">
                <strong>Suggestion:</strong> {warning.suggestion}
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </div>
    );
  };

  const MetricsGrid = ({ metrics }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-slate-500">Average Score</p>
              <p className="text-2xl font-bold text-white">{metrics.averageScore}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm text-slate-500">Submissions</p>
              <p className="text-2xl font-bold text-white">{metrics.totalSubmissions}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-sm text-slate-500">Error Rate</p>
              <p className="text-2xl font-bold text-white">{(metrics.errorRate * 100).toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-sm text-slate-500">Days Since Last</p>
              <p className="text-2xl font-bold text-white">
                {metrics.daysSinceLastSubmission !== null ? metrics.daysSinceLastSubmission : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const ClassroomInsights = ({ insights }) => {
    if (!insights) return null;

    const { distribution, strugglingStudents, weakConcepts } = insights;
    const total = distribution.weak + distribution.average + distribution.strong;

    return (
      <div className="space-y-6">
        {/* Performance Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Performance Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400">{distribution.weak}</div>
                <div className="text-sm text-slate-400">Need Support</div>
                <div className="text-xs text-slate-500">
                  {total > 0 ? ((distribution.weak / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400">{distribution.average}</div>
                <div className="text-sm text-slate-400">Developing</div>
                <div className="text-xs text-slate-500">
                  {total > 0 ? ((distribution.average / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">{distribution.strong}</div>
                <div className="text-sm text-slate-400">Proficient</div>
                <div className="text-xs text-slate-500">
                  {total > 0 ? ((distribution.strong / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Struggling Students Alert */}
        {strugglingStudents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Students Needing Attention ({strugglingStudents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {strugglingStudents.map((student, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                    <div>
                      <div className="font-medium text-white">{student.email}</div>
                      <div className="text-sm text-red-300">Score: {student.score.toFixed(1)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Primary Issues:</div>
                      <div className="text-xs text-red-300">
                        {student.primaryIssues.join(', ').replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weak Concepts */}
        {weakConcepts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Concepts Needing Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {weakConcepts.map((concept, index) => (
                  <div key={index} className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <div className="font-medium text-orange-300">
                      {concept.concept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className="text-sm text-orange-400">
                      Class Average: {concept.proficiency.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  if (!currentUser || !classroom) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Performance Analytics</h1>
              <p className="text-slate-400">
                {viewMode === 'classroom' && isFaculty ? 'Classroom Overview' : 'Individual Progress Tracking'}
              </p>
            </div>
            <Button
              onClick={loadPerformanceData}
              disabled={refreshing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* Faculty can switch between classroom and individual view */}
        {isFaculty && (
          <Tabs defaultValue={viewMode} className="mb-6">
            <TabsList>
              <TabsTrigger value="classroom">Classroom Overview</TabsTrigger>
              <TabsTrigger value="student">Individual Student</TabsTrigger>
            </TabsList>

            {/* Classroom Overview */}
            <TabsContent value="classroom">
              {classroomData ? (
                <ClassroomInsights insights={classroomData.insights} />
              ) : (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
              )}
            </TabsContent>

            {/* Individual Student View */}
            <TabsContent value="student">
              {classroom.student_emails && classroom.student_emails.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select Student:
                  </label>
                  <select 
                    value={selectedStudent || ''}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                  >
                    <option value="">Select a student...</option>
                    {classroom.student_emails.map(email => (
                      <option key={email} value={email}>{email}</option>
                    ))}
                  </select>
                </div>
              )}

              {performanceData && (
                <StudentPerformanceView data={performanceData} />
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Student view (non-faculty users) */}
        {!isFaculty && performanceData && (
          <StudentPerformanceView data={performanceData} />
        )}
      </div>
    </div>
  );

  function StudentPerformanceView({ data }) {
    return (
      <div className="space-y-6">
        {/* Performance Overview */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl text-white">Performance Summary</CardTitle>
                <CardDescription>Overall score: {data.overallScore}/100</CardDescription>
              </div>
              <PerformanceBadge category={data.category} />
            </div>
          </CardHeader>
          <CardContent>
            <MetricsGrid metrics={data.metrics} />
          </CardContent>
        </Card>

        {/* Warnings */}
        {data.warnings && data.warnings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Performance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WarningAlerts warnings={data.warnings} />
            </CardContent>
          </Card>
        )}

        {/* Skill Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Programming Concepts Mastery
            </CardTitle>
            <CardDescription>
              Your proficiency levels across different programming concepts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SkillHeatmap conceptSkills={data.conceptSkills} />
          </CardContent>
        </Card>

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Personalized Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recommendations.map((rec, index) => (
                  <div key={index} className={`p-4 rounded-lg border ${
                    rec.priority === 'urgent' ? 'border-red-500/50 bg-red-500/10' :
                    rec.priority === 'high' ? 'border-orange-500/50 bg-orange-500/10' :
                    'border-blue-500/50 bg-blue-500/10'
                  }`}>
                    <h4 className="font-medium text-white mb-2">{rec.title}</h4>
                    <p className="text-sm text-slate-300 mb-3">{rec.description}</p>
                    {rec.actions && rec.actions.length > 0 && (
                      <ul className="text-sm text-slate-400 space-y-1">
                        {rec.actions.map((action, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
}