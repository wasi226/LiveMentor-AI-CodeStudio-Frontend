import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Target, AlertCircle, CheckCircle2 } from 'lucide-react';
import StatCard from '@/components/ui-custom/StatCard';
import ChartCard from '@/components/ui-custom/ChartCard';
import TopBar from '@/components/ui-custom/TopBar';

const CHART_COLORS = {
  indigo: '#818cf8',
  violet: '#a78bfa',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
  sky: '#38bdf8',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1117] border border-slate-700/80 rounded-xl px-3 py-2.5 shadow-2xl text-[12px]">
      {label && <p className="text-slate-400 mb-1.5 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-semibold text-white tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const axisStyle = { fill: '#475569', fontSize: 11, fontFamily: 'inherit' };

export default function Analytics() {
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => Promise.resolve({ email: 'user@example.com', name: 'User' }) });

  const { data: submissions = [] } = useQuery({
    queryKey: ['analyticsSubmissions'],
    queryFn: () => Promise.resolve([]),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['analyticsAssignments'],
    queryFn: () => Promise.resolve([]),
  });

  // Computed stats
  const avgScore = submissions.length > 0
    ? Math.round(submissions.reduce((s, sub) => s + (sub.score || 0), 0) / submissions.length)
    : 74;
  const completionRate = assignments.length > 0
    ? Math.min(100, Math.round((submissions.length / (assignments.length * 3)) * 100))
    : 82;
  const errorRate = submissions.length > 0
    ? Math.round((submissions.filter(s => s.error_count > 0).length / submissions.length) * 100)
    : 14;

  // Weekly data (seeded for consistency)
  const weeklyData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => ({
    day,
    submissions: [4, 7, 5, 9, 6, 3, 2][i],
    avgScore: [68, 72, 75, 71, 80, 74, 69][i],
  }));

  // Monthly progress
  const progressData = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, i) => ({
    month,
    avgScore: [55, 61, 67, 72, 78, 83][i],
    completionRate: [45, 52, 60, 70, 76, 85][i],
  }));

  // Error trend
  const errorData = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'].map((week, i) => ({
    week,
    errors: [18, 14, 11, 8][i],
    resolved: [10, 12, 9, 7][i],
  }));

  // Difficulty distribution
  const diffData = [
    { name: 'Easy', value: Math.max(assignments.filter(a => a.difficulty === 'easy').length, 3) },
    { name: 'Medium', value: Math.max(assignments.filter(a => a.difficulty === 'medium').length, 5) },
    { name: 'Hard', value: Math.max(assignments.filter(a => a.difficulty === 'hard').length, 2) },
  ];

  // Language usage
  const langData = [
    { name: 'Python', count: 28 },
    { name: 'JavaScript', count: 24 },
    { name: 'Java', count: 16 },
    { name: 'C++', count: 12 },
    { name: 'TypeScript', count: 9 },
    { name: 'Go', count: 5 },
  ];

  // Score distribution
  const scoreDistData = [
    { range: '0–50', count: 4 },
    { range: '51–60', count: 6 },
    { range: '61–70', count: 10 },
    { range: '71–80', count: 18 },
    { range: '81–90', count: 14 },
    { range: '91–100', count: 8 },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <TopBar user={user} title="Analytics" subtitle="Performance insights & trends" />

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Avg Score" value={`${avgScore}%`} icon={TrendingUp} color="indigo" delay={0} subtitle="+6% this month" trend="up" />
          <StatCard title="Completion" value={`${completionRate}%`} icon={Target} color="emerald" delay={0.05} subtitle="Assignment rate" trend="up" />
          <StatCard title="Submissions" value={submissions.length || 42} icon={CheckCircle2} color="violet" delay={0.1} subtitle="This semester" />
          <StatCard title="Error Rate" value={`${errorRate}%`} icon={AlertCircle} color="rose" delay={0.15} subtitle="-3% improvement" trend="down" />
        </div>

        {/* Row 1 */}
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="Weekly Activity" subtitle="Submissions & average score by day" delay={0.1}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                  <Legend wrapperStyle={{ color: '#64748b', fontSize: 11 }} iconType="circle" iconSize={8} />
                  <Bar dataKey="submissions" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} name="Submissions" maxBarSize={28} />
                  <Bar dataKey="avgScore" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} name="Avg Score" maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Error Trend" subtitle="Errors vs resolved issues per week" delay={0.15}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={errorData}>
                  <defs>
                    <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.rose} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.rose} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="week" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ color: '#64748b', fontSize: 11 }} iconType="circle" iconSize={8} />
                  <Area type="monotone" dataKey="errors" stroke={CHART_COLORS.rose} strokeWidth={2} fill="url(#errorGrad)" name="Errors" dot={false} />
                  <Area type="monotone" dataKey="resolved" stroke={CHART_COLORS.emerald} strokeWidth={2} fill="url(#resolvedGrad)" name="Resolved" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Row 2 */}
        <div className="grid lg:grid-cols-3 gap-4">
          <ChartCard title="Student Progress" subtitle="Score & completion rate over time" delay={0.2} className="lg:col-span-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ color: '#64748b', fontSize: 11 }} iconType="circle" iconSize={8} />
                  <Line type="monotone" dataKey="avgScore" stroke={CHART_COLORS.indigo} strokeWidth={2} dot={{ fill: CHART_COLORS.indigo, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} name="Avg Score" />
                  <Line type="monotone" dataKey="completionRate" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={{ fill: CHART_COLORS.emerald, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} name="Completion %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="By Difficulty" subtitle="Assignment distribution" delay={0.25}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={diffData} cx="50%" cy="45%" innerRadius={48} outerRadius={75} paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {diffData.map((_, i) => (
                      <Cell key={i} fill={[CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.rose][i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#64748b', fontSize: 11 }} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Row 3 */}
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="Score Distribution" subtitle="Number of students per score range" delay={0.3}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="range" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                  <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {scoreDistData.map((entry, i) => (
                      <Cell key={i} fill={entry.range.startsWith('9') ? CHART_COLORS.emerald : entry.range.startsWith('8') ? CHART_COLORS.indigo : entry.range.startsWith('7') ? CHART_COLORS.violet : entry.range.startsWith('6') ? CHART_COLORS.amber : CHART_COLORS.rose} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Language Usage" subtitle="Most used programming languages" delay={0.35}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={langData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                  <Bar dataKey="count" fill={CHART_COLORS.indigo} radius={[0, 4, 4, 0]} name="Submissions" maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </main>
    </div>
  );
}