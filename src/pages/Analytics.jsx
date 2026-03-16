import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { TrendingUp, Target, AlertCircle, CheckCircle2 } from 'lucide-react';
import StatCard from '@/components/ui-custom/StatCard';
import ChartCard from '@/components/ui-custom/ChartCard';
import TopBar from '@/components/ui-custom/TopBar';
import { useAuth } from '@/lib/AuthContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const DAY_MS = 24 * 60 * 60 * 1000;

const CHART_COLORS = {
  indigo: '#818cf8',
  violet: '#a78bfa',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
  sky: '#38bdf8',
};

const toValidDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const getSubmissionDate = (submission) => {
  return toValidDate(
    submission?.submitted_at ||
    submission?.created_date ||
    submission?.created_at ||
    submission?.updated_at
  );
};

const getSubmissionScore = (submission) => {
  const score = Number(submission?.score);
  return Number.isFinite(score) ? score : null;
};

const hasSubmissionError = (submission) => {
  const count = Number(submission?.error_count);
  if (Number.isFinite(count) && count > 0) {
    return true;
  }

  return Boolean(submission?.error || submission?.error_message || submission?.stderr);
};

const isCompletedSubmission = (submission) => {
  const status = String(submission?.status || '').toLowerCase();
  return ['submitted', 'grading', 'graded', 'returned', 'completed'].includes(status);
};

const buildAnalyticsDataset = (submissions, assignments) => {
  const scoredSubmissions = submissions
    .map((submission) => getSubmissionScore(submission))
    .filter((score) => score !== null);

  const avgScore = scoredSubmissions.length > 0
    ? Math.round(scoredSubmissions.reduce((sum, score) => sum + score, 0) / scoredSubmissions.length)
    : 0;

  const completedSubmissions = submissions.filter((submission) => isCompletedSubmission(submission));
  const completedAssignmentIds = new Set(
    completedSubmissions
      .map((submission) => submission.assignment_id)
      .filter(Boolean)
  );

  let completionRate = 0;
  if (assignments.length > 0) {
    completionRate = Math.min(100, Math.round((completedAssignmentIds.size / assignments.length) * 100));
  } else if (submissions.length > 0) {
    completionRate = Math.round((completedSubmissions.length / submissions.length) * 100);
  }

  const errorCount = submissions.filter((submission) => hasSubmissionError(submission)).length;
  const errorRate = submissions.length > 0
    ? Math.round((errorCount / submissions.length) * 100)
    : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weeklyBuckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    return {
      key: date.toISOString().slice(0, 10),
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      submissions: 0,
      scoreTotal: 0,
      scoreCount: 0
    };
  });

  const weeklyIndex = new Map(weeklyBuckets.map((bucket, index) => [bucket.key, index]));

  submissions.forEach((submission) => {
    const submissionDate = getSubmissionDate(submission);
    submissionDate.setHours(0, 0, 0, 0);
    const key = submissionDate.toISOString().slice(0, 10);
    const index = weeklyIndex.get(key);

    if (index === undefined) {
      return;
    }

    weeklyBuckets[index].submissions += 1;

    const score = getSubmissionScore(submission);
    if (score !== null) {
      weeklyBuckets[index].scoreTotal += score;
      weeklyBuckets[index].scoreCount += 1;
    }
  });

  const weeklyData = weeklyBuckets.map((bucket) => ({
    day: bucket.day,
    submissions: bucket.submissions,
    avgScore: bucket.scoreCount > 0 ? Math.round(bucket.scoreTotal / bucket.scoreCount) : 0
  }));

  const monthlyBuckets = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

    return {
      key,
      month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
      scoreTotal: 0,
      scoreCount: 0,
      submissions: 0,
      completed: 0
    };
  });

  const monthlyIndex = new Map(monthlyBuckets.map((bucket, index) => [bucket.key, index]));

  submissions.forEach((submission) => {
    const submissionDate = getSubmissionDate(submission);
    const key = `${submissionDate.getFullYear()}-${String(submissionDate.getMonth() + 1).padStart(2, '0')}`;
    const index = monthlyIndex.get(key);

    if (index === undefined) {
      return;
    }

    monthlyBuckets[index].submissions += 1;
    if (isCompletedSubmission(submission)) {
      monthlyBuckets[index].completed += 1;
    }

    const score = getSubmissionScore(submission);
    if (score !== null) {
      monthlyBuckets[index].scoreTotal += score;
      monthlyBuckets[index].scoreCount += 1;
    }
  });

  const progressData = monthlyBuckets.map((bucket) => ({
    month: bucket.month,
    avgScore: bucket.scoreCount > 0 ? Math.round(bucket.scoreTotal / bucket.scoreCount) : 0,
    completionRate: bucket.submissions > 0 ? Math.round((bucket.completed / bucket.submissions) * 100) : 0
  }));

  const weeklyErrorBuckets = Array.from({ length: 4 }, (_, index) => ({
    week: `Wk ${index + 1}`,
    errors: 0,
    resolved: 0
  }));

  submissions.forEach((submission) => {
    const submissionDate = getSubmissionDate(submission);
    const normalizedDate = new Date(submissionDate);
    normalizedDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today - normalizedDate) / DAY_MS);
    if (daysDiff < 0 || daysDiff >= 28) {
      return;
    }

    const bucketIndex = 3 - Math.floor(daysDiff / 7);
    const bucket = weeklyErrorBuckets[bucketIndex];

    if (hasSubmissionError(submission)) {
      bucket.errors += 1;
    }

    if (isCompletedSubmission(submission)) {
      bucket.resolved += 1;
    }
  });

  const difficultyCounts = assignments.reduce((accumulator, assignment) => {
    const difficulty = String(assignment?.difficulty || 'medium').toLowerCase();
    if (!accumulator[difficulty]) {
      accumulator[difficulty] = 0;
    }
    accumulator[difficulty] += 1;
    return accumulator;
  }, { easy: 0, medium: 0, hard: 0 });

  const diffData = [
    { name: 'Easy', value: difficultyCounts.easy || 0 },
    { name: 'Medium', value: difficultyCounts.medium || 0 },
    { name: 'Hard', value: difficultyCounts.hard || 0 },
  ];

  const languageCounts = submissions.reduce((accumulator, submission) => {
    const rawLanguage = String(submission?.language || 'unknown').toLowerCase();
    const label = rawLanguage.charAt(0).toUpperCase() + rawLanguage.slice(1);
    accumulator[label] = (accumulator[label] || 0) + 1;
    return accumulator;
  }, {});

  const langData = Object.entries(languageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const scoreBuckets = [
    { range: '0–50', min: 0, max: 50, count: 0 },
    { range: '51–60', min: 51, max: 60, count: 0 },
    { range: '61–70', min: 61, max: 70, count: 0 },
    { range: '71–80', min: 71, max: 80, count: 0 },
    { range: '81–90', min: 81, max: 90, count: 0 },
    { range: '91–100', min: 91, max: 100, count: 0 },
  ];

  scoredSubmissions.forEach((score) => {
    const bucket = scoreBuckets.find((entry) => score >= entry.min && score <= entry.max);
    if (bucket) {
      bucket.count += 1;
    }
  });

  const scoreDistData = scoreBuckets.map(({ range, count }) => ({ range, count }));

  return {
    avgScore,
    completionRate,
    errorRate,
    weeklyData,
    progressData,
    errorData: weeklyErrorBuckets,
    diffData,
    langData,
    scoreDistData
  };
};

const buildBaseOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#94a3b8',
        font: { size: 11 }
      }
    },
    tooltip: {
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      borderWidth: 1,
      titleColor: '#e2e8f0',
      bodyColor: '#cbd5e1'
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(30, 41, 59, 0.35)' },
      ticks: { color: '#64748b', font: { size: 11 } }
    },
    y: {
      grid: { color: 'rgba(30, 41, 59, 0.35)' },
      ticks: { color: '#64748b', font: { size: 11 } }
    }
  }
});

export default function Analytics() {
  const { user, getAuthHeaders } = useAuth();

  const { data: classrooms = [] } = useQuery({
    queryKey: ['analyticsClassrooms', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/classrooms`, {
          headers: getAuthHeaders()
        });

        if (!response.ok) {
          return [];
        }

        const payload = await response.json();
        return payload.classrooms || [];
      } catch (error) {
        console.error('Failed to fetch classrooms for analytics:', error);
        return [];
      }
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['analyticsSubmissions', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/submissions`, {
          headers: getAuthHeaders()
        });

        if (!response.ok) {
          return [];
        }

        const payload = await response.json();
        return payload.submissions || [];
      } catch (error) {
        console.error('Failed to fetch submissions for analytics:', error);
        return [];
      }
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['analyticsAssignments', classrooms.map((classroom) => classroom.id).join(',')],
    enabled: Boolean(user?.email && classrooms.length),
    queryFn: async () => {
      try {
        const assignmentResults = await Promise.all(
          classrooms.map(async (classroom) => {
            const response = await fetch(
              `${API_BASE_URL}/api/assignments?classroom_id=${encodeURIComponent(classroom.id)}`,
              { headers: getAuthHeaders() }
            );

            if (!response.ok) {
              return [];
            }

            const payload = await response.json();
            return payload.assignments || [];
          })
        );

        const deduplicated = new Map();
        assignmentResults.flat().forEach((assignment) => {
          const key = assignment.id || assignment._id || `${assignment.classroom_id}:${assignment.title}`;
          deduplicated.set(key, assignment);
        });

        return Array.from(deduplicated.values());
      } catch (error) {
        console.error('Failed to fetch assignments for analytics:', error);
        return [];
      }
    },
  });

  const {
    avgScore,
    completionRate,
    errorRate,
    weeklyData,
    progressData,
    errorData,
    diffData,
    langData,
    scoreDistData
  } = useMemo(() => buildAnalyticsDataset(submissions, assignments), [submissions, assignments]);

  const barOptions = useMemo(() => buildBaseOptions(), []);

  const progressOptions = useMemo(() => ({
    ...buildBaseOptions(),
    scales: {
      ...buildBaseOptions().scales,
      y: {
        ...buildBaseOptions().scales.y,
        min: 0,
        max: 100
      }
    }
  }), []);

  const pieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#e2e8f0',
        bodyColor: '#cbd5e1'
      }
    }
  }), []);

  const weeklyChartData = useMemo(() => ({
    labels: weeklyData.map((item) => item.day),
    datasets: [
      {
        label: 'Submissions',
        data: weeklyData.map((item) => item.submissions),
        backgroundColor: CHART_COLORS.indigo,
        borderRadius: 6
      },
      {
        label: 'Avg Score',
        data: weeklyData.map((item) => item.avgScore),
        backgroundColor: CHART_COLORS.violet,
        borderRadius: 6
      }
    ]
  }), [weeklyData]);

  const errorChartData = useMemo(() => ({
    labels: errorData.map((item) => item.week),
    datasets: [
      {
        label: 'Errors',
        data: errorData.map((item) => item.errors),
        borderColor: CHART_COLORS.rose,
        backgroundColor: 'rgba(251, 113, 133, 0.15)',
        fill: true,
        tension: 0.35
      },
      {
        label: 'Resolved',
        data: errorData.map((item) => item.resolved),
        borderColor: CHART_COLORS.emerald,
        backgroundColor: 'rgba(52, 211, 153, 0.15)',
        fill: true,
        tension: 0.35
      }
    ]
  }), [errorData]);

  const progressChartData = useMemo(() => ({
    labels: progressData.map((item) => item.month),
    datasets: [
      {
        label: 'Avg Score',
        data: progressData.map((item) => item.avgScore),
        borderColor: CHART_COLORS.indigo,
        backgroundColor: 'rgba(129, 140, 248, 0.15)',
        fill: true,
        tension: 0.35
      },
      {
        label: 'Completion %',
        data: progressData.map((item) => item.completionRate),
        borderColor: CHART_COLORS.emerald,
        backgroundColor: 'rgba(52, 211, 153, 0.15)',
        fill: true,
        tension: 0.35
      }
    ]
  }), [progressData]);

  const difficultyChartData = useMemo(() => ({
    labels: diffData.map((item) => item.name),
    datasets: [
      {
        label: 'Assignments',
        data: diffData.map((item) => item.value),
        backgroundColor: [CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.rose],
        borderWidth: 0
      }
    ]
  }), [diffData]);

  const scoreDistributionData = useMemo(() => ({
    labels: scoreDistData.map((item) => item.range),
    datasets: [
      {
        label: 'Students',
        data: scoreDistData.map((item) => item.count),
        backgroundColor: [
          CHART_COLORS.rose,
          CHART_COLORS.amber,
          CHART_COLORS.violet,
          CHART_COLORS.indigo,
          CHART_COLORS.sky,
          CHART_COLORS.emerald,
        ],
        borderRadius: 6
      }
    ]
  }), [scoreDistData]);

  const languageUsageData = useMemo(() => ({
    labels: langData.map((item) => item.name),
    datasets: [
      {
        label: 'Submissions',
        data: langData.map((item) => item.count),
        backgroundColor: CHART_COLORS.indigo,
        borderRadius: 6
      }
    ]
  }), [langData]);

  const horizontalBarOptions = useMemo(() => ({
    ...buildBaseOptions(),
    indexAxis: 'y'
  }), []);

  return (
    <div className="min-h-screen bg-slate-950">
      <TopBar user={user} title="Analytics" subtitle="Performance insights & trends" />

      <main className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Avg Score" value={`${avgScore}%`} icon={TrendingUp} color="indigo" delay={0} subtitle="From graded submissions" trend={avgScore >= 70 ? 'up' : 'down'} />
          <StatCard title="Completion" value={`${completionRate}%`} icon={Target} color="emerald" delay={0.05} subtitle="Assignment completion" trend={completionRate >= 60 ? 'up' : 'down'} />
          <StatCard title="Submissions" value={submissions.length} icon={CheckCircle2} color="violet" delay={0.1} subtitle="Total recorded attempts" />
          <StatCard title="Error Rate" value={`${errorRate}%`} icon={AlertCircle} color="rose" delay={0.15} subtitle="Submissions with errors" trend={errorRate <= 25 ? 'down' : 'up'} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="Weekly Activity" subtitle="Submissions & average score by day" delay={0.1}>
            <div className="h-56">
              <Bar data={weeklyChartData} options={barOptions} />
            </div>
          </ChartCard>

          <ChartCard title="Error Trend" subtitle="Errors vs resolved issues per week" delay={0.15}>
            <div className="h-56">
              <Line data={errorChartData} options={barOptions} />
            </div>
          </ChartCard>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <ChartCard title="Student Progress" subtitle="Score & completion rate over time" delay={0.2} className="lg:col-span-2">
            <div className="h-56">
              <Line data={progressChartData} options={progressOptions} />
            </div>
          </ChartCard>

          <ChartCard title="By Difficulty" subtitle="Assignment distribution" delay={0.25}>
            <div className="h-56">
              <Pie data={difficultyChartData} options={pieOptions} />
            </div>
          </ChartCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="Score Distribution" subtitle="Number of students per score range" delay={0.3}>
            <div className="h-52">
              <Bar data={scoreDistributionData} options={barOptions} />
            </div>
          </ChartCard>

          <ChartCard title="Language Usage" subtitle="Most used programming languages" delay={0.35}>
            <div className="h-52">
              <Bar data={languageUsageData} options={horizontalBarOptions} />
            </div>
          </ChartCard>
        </div>
      </main>
    </div>
  );
}