/**
 * Student Performance Analytics & Categorization System
 * Tracks student progress, categorizes performance levels,
 * and provides early warning alerts for struggling students
 */

import { getAuthToken } from '@/lib/authStorage';
import { API_BASE_URL } from '@/lib/apiBaseUrl';

// Performance categories and thresholds
export const PERFORMANCE_CATEGORIES = {
  WEAK: { min: 0, max: 40, color: '#ef4444', label: 'Needs Support' },
  AVERAGE: { min: 40, max: 75, color: '#f97316', label: 'Developing' },
  STRONG: { min: 75, max: 100, color: '#22c55e', label: 'Proficient' }
};

// Programming concepts for skill tracking
export const PROGRAMMING_CONCEPTS = {
  VARIABLES: 'variables_and_data_types',
  CONTROL_FLOW: 'control_flow',
  FUNCTIONS: 'functions_and_methods', 
  LOOPS: 'loops_and_iteration',
  CONDITIONALS: 'conditionals',
  DATA_STRUCTURES: 'data_structures',
  ALGORITHMS: 'algorithms',
  DEBUGGING: 'debugging_skills',
  CODE_ORGANIZATION: 'code_organization',
  PROBLEM_SOLVING: 'problem_solving'
};

const normalizeTimestamp = (record) => {
  const raw =
    record?.created_date ||
    record?.created_at ||
    record?.submitted_at ||
    record?.updated_at ||
    record?.updated_date;

  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const isCompletedSubmission = (submission) => {
  const status = String(submission?.status || '').toLowerCase();
  return ['submitted', 'grading', 'graded', 'returned', 'completed'].includes(status);
};

class PerformanceAnalytics {
  constructor() {
    this.metrics = new Map();
    this.conceptScores = new Map();
    this.warningThresholds = {
      errorRate: 0.7,        // 70% error rate triggers warning
      lowScore: 30,          // Scores below 30 trigger warning
      inactivityDays: 7,     // 7 days without submission triggers warning
      helpRequests: 10       // More than 10 AI help requests per day
    };
  }

  getAuthHeaders() {
    const token = getAuthToken();

    return token
      ? {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      : {
          'Content-Type': 'application/json'
        };
  }

  async apiGet(path) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Request failed for ${path} with status ${response.status}`);
    }

    return response.json();
  }

  async fetchSubmissions({ classroomId = null, studentEmail = null } = {}) {
    const params = new URLSearchParams();

    if (classroomId) {
      params.set('classroom_id', classroomId);
    }

    if (studentEmail) {
      params.set('student_email', studentEmail);
    }

    const query = params.toString();
  const path = query ? `/api/submissions?${query}` : '/api/submissions';
  const payload = await this.apiGet(path);

    return payload?.submissions || [];
  }

  async fetchChatMessages(classroomId) {
    if (!classroomId) {
      return [];
    }

    try {
      const payload = await this.apiGet(`/api/chat/messages?classroom_id=${encodeURIComponent(classroomId)}&limit=200`);
      return payload?.messages || [];
    } catch {
      // Chat history may be unavailable when the data service is not configured.
      return [];
    }
  }

  async fetchClassroom(classroomId) {
    const payload = await this.apiGet(`/api/classrooms/${classroomId}`);
    return payload?.classroom || null;
  }

  /**
   * Analyze student performance based on submissions
   */
  async analyzeStudentPerformance(studentEmail, classroomId = null) {
    try {
      let submissions = await this.fetchSubmissions({
        classroomId,
        studentEmail
      });

      submissions = submissions.filter((submission) => {
        if (!studentEmail) {
          return true;
        }

        return submission.student_email === studentEmail;
      });

      let chatMessages = await this.fetchChatMessages(classroomId);
      chatMessages = chatMessages.filter((message) => {
        if (!studentEmail) {
          return true;
        }

        return message.sender_email === studentEmail;
      });

      const analysis = this.calculatePerformanceMetrics(submissions, chatMessages);
      const category = this.categorizePerformance(analysis.overallScore);
      const conceptSkills = this.analyzeConceptualSkills(submissions);
      const warnings = this.generateWarnings(analysis, conceptSkills);

      return {
        studentEmail,
        category,
        overallScore: analysis.overallScore,
        metrics: analysis,
        conceptSkills,
        warnings,
        recommendations: this.generateRecommendations(category, conceptSkills, warnings),
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error analyzing student performance:', error);
      return null;
    }
  }

  /**
   * Calculate comprehensive performance metrics
   */
  calculatePerformanceMetrics(submissions, chatMessages) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter recent submissions (last 30 days)
    const recentSubmissions = submissions.filter(s => 
      normalizeTimestamp(s) >= thirtyDaysAgo
    );

    // Calculate basic metrics
    const totalSubmissions = recentSubmissions.length;
    const completedSubmissions = recentSubmissions.filter(s => isCompletedSubmission(s)).length;
    const scores = recentSubmissions.map(s => s.score || 0).filter(score => score > 0);
    
    const averageScore = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;

    const errorCount = recentSubmissions.reduce((sum, s) => sum + (s.error_count || 0), 0);
    const errorRate = totalSubmissions > 0 ? errorCount / totalSubmissions : 0;

    // Calculate improvement trend (last 10 vs previous 10 submissions)
    let improvementTrend = 0;
    if (scores.length >= 20) {
      const recentScores = scores.slice(-10);
      const previousScores = scores.slice(-20, -10);
      const recentAvg = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;
      const previousAvg = previousScores.reduce((sum, s) => sum + s, 0) / previousScores.length;
      improvementTrend = recentAvg - previousAvg;
    }

    // Calculate consistency (standard deviation of scores)
    const consistency = this.calculateConsistency(scores);

    // Time-based metrics
    const lastSubmissionDate = recentSubmissions.length > 0 
      ? new Date(Math.max(...recentSubmissions.map(s => normalizeTimestamp(s).getTime())))
      : null;

    const daysSinceLastSubmission = lastSubmissionDate 
      ? Math.floor((now - lastSubmissionDate) / (1000 * 60 * 60 * 24))
      : null;

    // AI help frequency
    const aiHelpRequests = chatMessages.filter(msg => 
      msg.type === 'ai_request' && 
      normalizeTimestamp(msg) >= thirtyDaysAgo
    ).length;

    // Speed metrics (time between submissions)
    const submissionIntervals = this.calculateSubmissionIntervals(recentSubmissions);
    const averageSubmissionInterval = submissionIntervals.length > 0
      ? submissionIntervals.reduce((sum, interval) => sum + interval, 0) / submissionIntervals.length
      : null;

    // Overall performance score calculation
    const overallScore = this.calculateOverallScore({
      averageScore,
      errorRate,
      consistency,
      improvementTrend,
      completionRate: totalSubmissions > 0 ? completedSubmissions / totalSubmissions : 0
    });

    return {
      totalSubmissions,
      completedSubmissions,
      averageScore: Math.round(averageScore * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      errorCount,
      consistency,
      improvementTrend: Math.round(improvementTrend * 100) / 100,
      daysSinceLastSubmission,
      aiHelpRequests,
      averageSubmissionInterval,
      overallScore: Math.round(overallScore * 100) / 100
    };
  }

  /**
   * Calculate overall performance score (0-100)
   */
  calculateOverallScore({ averageScore, errorRate, consistency, improvementTrend, completionRate }) {
    // Weighted scoring system
    const weights = {
      averageScore: 0.4,      // 40% - Most important
      completionRate: 0.25,   // 25% - Task completion
      consistency: 0.15,      // 15% - Performance stability
      errorRate: 0.15,        // 15% - Error frequency (inverted)
      improvementTrend: 0.05  // 5% - Learning progress
    };

    // Normalize error rate (lower is better)
    const normalizedErrorRate = Math.max(0, 1 - errorRate);
    
    // Normalize consistency (lower standard deviation is better)
    const normalizedConsistency = Math.max(0, 1 - (consistency / 50)); // Assuming max std dev of 50
    
    // Normalize improvement trend (-20 to +20 range)
    const normalizedImprovement = Math.max(0, Math.min(1, (improvementTrend + 20) / 40));

    const score = (
      averageScore * weights.averageScore +
      (completionRate * 100) * weights.completionRate +
      (normalizedConsistency * 100) * weights.consistency +
      (normalizedErrorRate * 100) * weights.errorRate +
      (normalizedImprovement * 100) * weights.improvementTrend
    );

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate performance consistency (standard deviation)
   */
  calculateConsistency(scores) {
    if (scores.length < 2) return 0;
    
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const squaredDifferences = scores.map(score => Math.pow(score - mean, 2));
    const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / scores.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate submission intervals for speed analysis
   */
  calculateSubmissionIntervals(submissions) {
    if (submissions.length < 2) return [];
    
    const sortedSubmissions = [...submissions].sort((a, b) => 
      normalizeTimestamp(a) - normalizeTimestamp(b)
    );

    const intervals = [];
    for (let i = 1; i < sortedSubmissions.length; i++) {
      const prev = normalizeTimestamp(sortedSubmissions[i - 1]);
      const curr = normalizeTimestamp(sortedSubmissions[i]);
      intervals.push(Math.floor((curr - prev) / (1000 * 60 * 60))); // Hours
    }

    return intervals;
  }

  /**
   * Categorize student performance level
   */
  categorizePerformance(score) {
    if (score >= PERFORMANCE_CATEGORIES.STRONG.min) {
      return { level: 'STRONG', ...PERFORMANCE_CATEGORIES.STRONG };
    } else if (score >= PERFORMANCE_CATEGORIES.AVERAGE.min) {
      return { level: 'AVERAGE', ...PERFORMANCE_CATEGORIES.AVERAGE };
    } else {
      return { level: 'WEAK', ...PERFORMANCE_CATEGORIES.WEAK };
    }
  }

  /**
   * Analyze conceptual programming skills
   */
  analyzeConceptualSkills(submissions) {
    const conceptScores = {};
    
    // Initialize all concepts
    Object.values(PROGRAMMING_CONCEPTS).forEach(concept => {
      conceptScores[concept] = { 
        score: 0, 
        attempts: 0, 
        successes: 0,
        lastPracticed: null
      };
    });

    submissions.forEach(submission => {
      // Analyze code to detect concepts used
      const detectedConcepts = this.detectProgrammingConcepts(submission.code, submission.language);
      
      detectedConcepts.forEach(concept => {
        const conceptData = conceptScores[concept];
        conceptData.attempts++;
        
        // Add to score based on submission success
        const submissionScore = submission.score || 0;
        conceptData.score += submissionScore;
        
        if (submissionScore >= 70) { // Consider 70+ as success
          conceptData.successes++;
        }
        
        conceptData.lastPracticed = normalizeTimestamp(submission).toISOString();
      });
    });

    // Calculate final concept proficiency scores
    Object.keys(conceptScores).forEach(concept => {
      const data = conceptScores[concept];
      if (data.attempts > 0) {
        data.proficiency = data.score / data.attempts;
        data.successRate = (data.successes / data.attempts) * 100;
      } else {
        data.proficiency = 0;
        data.successRate = 0;
      }
    });

    return conceptScores;
  }

  /**
   * Detect programming concepts in code
   */
  detectProgrammingConcepts(code, language) {
    const concepts = [];
    const codeStr = String(code || '').toLowerCase();

    // Variable detection
    if (codeStr.includes('=') && !codeStr.includes('==')) {
      concepts.push(PROGRAMMING_CONCEPTS.VARIABLES);
    }

    // Control flow detection
    if (codeStr.includes('if') || codeStr.includes('else')) {
      concepts.push(PROGRAMMING_CONCEPTS.CONDITIONALS);
    }

    // Loop detection
    if (codeStr.includes('for') || codeStr.includes('while')) {
      concepts.push(PROGRAMMING_CONCEPTS.LOOPS);
    }

    // Function detection
    if (codeStr.includes('function') || codeStr.includes('def ') || codeStr.includes('public static')) {
      concepts.push(PROGRAMMING_CONCEPTS.FUNCTIONS);
    }

    // Data structure detection
    if (codeStr.includes('[') || codeStr.includes('list') || codeStr.includes('array')) {
      concepts.push(PROGRAMMING_CONCEPTS.DATA_STRUCTURES);
    }

    // Always include problem solving if there's substantial code
    if (codeStr.length > 50) {
      concepts.push(PROGRAMMING_CONCEPTS.PROBLEM_SOLVING);
    }

    return [...new Set(concepts)]; // Remove duplicates
  }

  /**
   * Generate performance warnings
   */
  generateWarnings(metrics, conceptSkills) {
    const warnings = [];

    // High error rate warning
    if (metrics.errorRate > this.warningThresholds.errorRate) {
      warnings.push({
        type: 'HIGH_ERROR_RATE',
        severity: 'high',
        message: `High error rate (${(metrics.errorRate * 100).toFixed(1)}%). Student may need debugging support.`,
        suggestion: 'Recommend step-by-step debugging tutorials and practice exercises.'
      });
    }

    // Low score warning
    if (metrics.averageScore < this.warningThresholds.lowScore) {
      warnings.push({
        type: 'LOW_PERFORMANCE',
        severity: 'high',
        message: `Below-average performance (${metrics.averageScore.toFixed(1)}/100). Immediate intervention recommended.`,
        suggestion: 'Schedule one-on-one tutoring session and review fundamental concepts.'
      });
    }

    // Inactivity warning
    if (metrics.daysSinceLastSubmission > this.warningThresholds.inactivityDays) {
      warnings.push({
        type: 'INACTIVITY',
        severity: 'medium',
        message: `No submissions for ${metrics.daysSinceLastSubmission} days. Student may be disengaged.`,
        suggestion: 'Send personalized check-in message and offer additional support resources.'
      });
    }

    // Excessive help requests
    if (metrics.aiHelpRequests > this.warningThresholds.helpRequests) {
      warnings.push({
        type: 'OVER_RELIANCE_ON_HELP',
        severity: 'medium',
        message: `High AI help usage (${metrics.aiHelpRequests} requests). May indicate conceptual gaps.`,
        suggestion: 'Focus on building independent problem-solving skills through guided practice.'
      });
    }

    // Concept-specific warnings
    Object.entries(conceptSkills).forEach(([concept, data]) => {
      if (data.attempts > 0 && data.proficiency < 40) {
        warnings.push({
          type: 'CONCEPT_WEAKNESS',
          severity: 'medium',
          message: `Struggling with ${concept.replaceAll('_', ' ')} (${data.proficiency.toFixed(1)}% proficiency).`,
          suggestion: `Provide targeted practice exercises for ${concept.replaceAll('_', ' ')}.`
        });
      }
    });

    return warnings;
  }

  /**
   * Generate personalized recommendations
   */
  generateRecommendations(category, conceptSkills, warnings) {
    const recommendations = [];

    // Category-based recommendations
    switch (category.level) {
      case 'WEAK':
        recommendations.push({
          type: 'FOUNDATIONAL_SUPPORT',
          priority: 'high',
          title: 'Build Strong Foundation',
          description: 'Focus on fundamental programming concepts with guided practice.',
          actions: [
            'Complete basic programming tutorials',
            'Practice with simple, well-defined problems',
            'Use step-by-step debugging tools regularly',
            'Schedule regular check-ins with instructor'
          ]
        });
        break;

      case 'AVERAGE':
        recommendations.push({
          type: 'SKILL_DEVELOPMENT',
          priority: 'medium',
          title: 'Develop Advanced Skills',
          description: 'Strengthen existing knowledge and tackle more challenging problems.',
          actions: [
            'Work on intermediate-level coding challenges',
            'Focus on code organization and best practices',
            'Practice algorithmic thinking',
            'Collaborate on group projects'
          ]
        });
        break;

      case 'STRONG':
        recommendations.push({
          type: 'ADVANCED_CHALLENGES',
          priority: 'low',
          title: 'Take on Leadership',
          description: 'Mentor others and tackle complex, real-world problems.',
          actions: [
            'Mentor struggling classmates',
            'Lead group programming projects',
            'Explore advanced algorithms and data structures',
            'Contribute to open-source projects'
          ]
        });
        break;
    }

    // Warning-based recommendations
    warnings.forEach(warning => {
      if (warning.severity === 'high') {
        recommendations.unshift({
          type: 'URGENT_INTERVENTION',
          priority: 'urgent',
          title: warning.message,
          description: warning.suggestion,
          actions: ['Immediate instructor intervention required']
        });
      }
    });

    return recommendations;
  }

  /**
   * Generate skill heatmap data
   */
  generateSkillHeatmap(conceptSkills) {
    return Object.entries(conceptSkills).map(([concept, data]) => ({
      concept: concept
        .replaceAll('_', ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      proficiency: data.proficiency || 0,
      attempts: data.attempts || 0,
      successRate: data.successRate || 0,
      lastPracticed: data.lastPracticed,
      color: this.getHeatmapColor(data.proficiency || 0)
    }));
  }

  /**
   * Get color for heatmap based on proficiency
   */
  getHeatmapColor(proficiency) {
    if (proficiency >= 80) return '#22c55e'; // Green - Strong
    if (proficiency >= 60) return '#eab308'; // Yellow - Average  
    if (proficiency >= 40) return '#f97316'; // Orange - Developing
    return '#ef4444'; // Red - Weak
  }

  /**
   * Batch analyze all students in a classroom
   */
  async analyzeClassroomPerformance(classroomId) {
    try {
      const classroom = await this.fetchClassroom(classroomId);
      if (!classroom) {
        return null;
      }

      const studentEmails = classroom.student_emails || [];

      const studentAnalyses = [];
      for (const studentEmail of studentEmails) {
        const analysis = await this.analyzeStudentPerformance(studentEmail, classroomId);
        if (analysis) {
          studentAnalyses.push(analysis);
        }
      }

      // Generate classroom insights
      const classroomInsights = this.generateClassroomInsights(studentAnalyses);

      return {
        classroomId,
        totalStudents: studentEmails.length,
        analyzedStudents: studentAnalyses.length,
        students: studentAnalyses,
        insights: classroomInsights,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error analyzing classroom performance:', error);
      return null;
    }
  }

  /**
   * Generate insights for entire classroom
   */
  generateClassroomInsights(studentAnalyses) {
    const totalStudents = studentAnalyses.length;
    
    if (totalStudents === 0) return null;

    // Performance distribution
    const distribution = {
      weak: studentAnalyses.filter(s => s.category.level === 'WEAK').length,
      average: studentAnalyses.filter(s => s.category.level === 'AVERAGE').length,
      strong: studentAnalyses.filter(s => s.category.level === 'STRONG').length
    };

    // Average metrics
    const avgScore = studentAnalyses.reduce((sum, s) => sum + s.overallScore, 0) / totalStudents;
    const avgErrorRate = studentAnalyses.reduce((sum, s) => sum + s.metrics.errorRate, 0) / totalStudents;

    // Students needing attention
    const strugglingStudents = studentAnalyses.filter(s => 
      s.warnings.some(w => w.severity === 'high')
    );

    // Concept analysis across classroom
    const classroomConcepts = this.analyzeClassroomConcepts(studentAnalyses);

    return {
      distribution,
      averageScore: Math.round(avgScore * 100) / 100,
      averageErrorRate: Math.round(avgErrorRate * 100) / 100,
      strugglingStudentsCount: strugglingStudents.length,
      strugglingStudents: strugglingStudents.map(s => ({
        email: s.studentEmail,
        score: s.overallScore,
        primaryIssues: s.warnings.filter(w => w.severity === 'high').map(w => w.type)
      })),
      weakConcepts: classroomConcepts.weak,
      strongConcepts: classroomConcepts.strong
    };
  }

  /**
   * Analyze concept mastery across classroom
   */
  analyzeClassroomConcepts(studentAnalyses) {
    const conceptAggregates = {};

    // Initialize concept tracking
    Object.values(PROGRAMMING_CONCEPTS).forEach(concept => {
      conceptAggregates[concept] = {
        totalProficiency: 0,
        studentCount: 0,
        averageProficiency: 0
      };
    });

    // Aggregate concept data
    studentAnalyses.forEach(student => {
      Object.entries(student.conceptSkills).forEach(([concept, data]) => {
        if (data.attempts > 0) {
          conceptAggregates[concept].totalProficiency += data.proficiency;
          conceptAggregates[concept].studentCount++;
        }
      });
    });

    // Calculate averages and identify weak/strong concepts
    const weak = [];
    const strong = [];

    Object.entries(conceptAggregates).forEach(([concept, data]) => {
      if (data.studentCount > 0) {
        data.averageProficiency = data.totalProficiency / data.studentCount;
        
        if (data.averageProficiency < 50) {
          weak.push({ concept, proficiency: data.averageProficiency });
        } else if (data.averageProficiency > 80) {
          strong.push({ concept, proficiency: data.averageProficiency });
        }
      }
    });

    return { weak, strong };
  }
}

// Export singleton instance
const performanceAnalytics = new PerformanceAnalytics();
export default performanceAnalytics;