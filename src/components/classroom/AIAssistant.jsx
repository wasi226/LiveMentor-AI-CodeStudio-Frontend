/* eslint-disable react/prop-types */
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, User, Zap, Wrench, Lightbulb, BookOpen, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import aiPairProgrammer from '@/services/aiPairProgrammer';

const createMessage = (role, content) => ({
  id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  role,
  content
});

const QUICK_PROMPTS = [
  'Explain this code',
  'Find bugs',
  'Optimize it',
  'Add comments',
];

const ACTIONS = [
  {
    key: 'explain',
    title: 'Explain Code',
    description: 'Understand flow, concepts, and risks in current code.',
    icon: BookOpen
  },
  {
    key: 'review',
    title: 'Bug + Optimize',
    description: 'Detect likely bugs and suggest performance improvements.',
    icon: AlertTriangle
  },
  {
    key: 'complete',
    title: 'Smart Completion',
    description: 'Generate logic continuation and recommend next steps.',
    icon: Lightbulb
  }
];

export default function AIAssistant({ code, language, onApplyCodeSuggestion }) {
  const [messages, setMessages] = useState([
    createMessage('assistant', `Hello! I'm your AI coding tutor for **${language}**. I can help you debug, explain concepts, optimize your code, or answer any questions. What would you like to work on?`)
  ]);
  const [input, setInput] = useState('');
  const [actionPrompt, setActionPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState('');
  const [structuredResult, setStructuredResult] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput('');
    setMessages(prev => [...prev, createMessage('user', userMsg)]);
    setLoading(true);
    setStructuredResult(null);

    try {
      const history = messages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .slice(-10)
        .map((msg) => ({ role: msg.role, content: msg.content }));

      const payload = await aiPairProgrammer.chatAssistant({
        message: userMsg,
        code,
        language,
        history
      });

      setMessages(prev => [...prev, createMessage('assistant', payload.response)]);
    } catch (error) {
      console.error('AI Assistant Error:', error);
      setMessages(prev => [...prev, { 
        ...createMessage('assistant', `Sorry, I encountered an error while processing your request: ${error.message}`)
      }]);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (actionKey) => {
    if (loading || !String(code || '').trim()) {
      return;
    }

    setLoading(true);
    setActiveAction(actionKey);
    setStructuredResult(null);

    try {
      if (actionKey === 'explain') {
        const payload = await aiPairProgrammer.explainCode({
          code,
          language,
          focus: actionPrompt
        });
        setStructuredResult({ type: 'explain', data: payload.data });
      }

      if (actionKey === 'review') {
        const payload = await aiPairProgrammer.reviewCode({
          code,
          language,
          goal: actionPrompt
        });
        setStructuredResult({ type: 'review', data: payload.data });
      }

      if (actionKey === 'complete') {
        const payload = await aiPairProgrammer.completeCode({
          code,
          language,
          cursorPosition: String(code || '').length,
          userIntent: actionPrompt
        });
        setStructuredResult({ type: 'complete', data: payload.data });
      }
    } catch (error) {
      console.error('AI action error:', error);
      setStructuredResult({
        type: 'error',
        data: { message: error.message || 'Failed to run AI pair programmer action.' }
      });
    } finally {
      setLoading(false);
      setActiveAction('');
    }
  };

  const renderStructuredResult = () => {
    if (!structuredResult) {
      return null;
    }

    if (structuredResult.type === 'error') {
      return (
        <div className="mx-3 mb-2 p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-[11px]">
          {structuredResult.data?.message || 'AI request failed.'}
        </div>
      );
    }

    if (structuredResult.type === 'explain') {
      const data = structuredResult.data || {};
      return (
        <div className="mx-3 mb-2 p-2.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-[11px] space-y-2">
          <p className="text-slate-200 leading-relaxed">{data.summary || 'No summary generated.'}</p>
          {Array.isArray(data.stepByStep) && data.stepByStep.length > 0 && (
            <div>
              <p className="text-indigo-300 font-semibold mb-1">Step-by-step</p>
              <ul className="space-y-1 text-slate-300">
                {data.stepByStep.slice(0, 6).map((item, index) => (
                  <li key={`${item}-${index}`}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(data.concepts) && data.concepts.length > 0 && (
            <p className="text-slate-300">Concepts: {data.concepts.slice(0, 6).join(', ')}</p>
          )}
          {Array.isArray(data.risks) && data.risks.length > 0 && (
            <p className="text-amber-200">Risks: {data.risks.slice(0, 4).join(' | ')}</p>
          )}
        </div>
      );
    }

    if (structuredResult.type === 'review') {
      const data = structuredResult.data || {};
      return (
        <div className="mx-3 mb-2 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] space-y-2">
          <p className="text-slate-200 leading-relaxed">{data.overview || 'No review overview generated.'}</p>
          {Array.isArray(data.bugs) && data.bugs.length > 0 && (
            <div>
              <p className="text-rose-300 font-semibold mb-1">Potential bugs</p>
              <div className="space-y-1.5">
                {data.bugs.slice(0, 4).map((bug, index) => (
                  <div key={`${bug?.title || 'bug'}-${index}`} className="p-2 rounded-md bg-slate-900/60 border border-slate-700/50">
                    <p className="text-slate-100 font-medium">{bug?.title || 'Issue'}</p>
                    <p className="text-rose-200">Severity: {bug?.severity || 'medium'}</p>
                    <p className="text-slate-300">{bug?.explanation || ''}</p>
                    <p className="text-emerald-200">Fix: {bug?.fixSuggestion || ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(data.optimizations) && data.optimizations.length > 0 && (
            <div>
              <p className="text-emerald-300 font-semibold mb-1">Optimization ideas</p>
              <div className="space-y-1.5">
                {data.optimizations.slice(0, 4).map((opt, index) => (
                  <div key={`${opt?.title || 'opt'}-${index}`} className="p-2 rounded-md bg-slate-900/60 border border-slate-700/50">
                    <p className="text-slate-100 font-medium">{opt?.title || 'Optimization'}</p>
                    <p className="text-cyan-200">Impact: {opt?.impact || 'medium'}</p>
                    <p className="text-slate-300">{opt?.explanation || ''}</p>
                    <p className="text-emerald-200">Suggestion: {opt?.suggestion || ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (structuredResult.type === 'complete') {
      const data = structuredResult.data || {};
      const canApply = typeof onApplyCodeSuggestion === 'function' && String(data.completedCode || '').trim();

      return (
        <div className="mx-3 mb-2 p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-[11px] space-y-2">
          <p className="text-slate-200">{data.reasoning || 'Generated completion suggestion.'}</p>
          {Array.isArray(data.nextSteps) && data.nextSteps.length > 0 && (
            <ul className="space-y-1 text-slate-300">
              {data.nextSteps.slice(0, 5).map((step, index) => (
                <li key={`${step}-${index}`}>• {step}</li>
              ))}
            </ul>
          )}
          {canApply && (
            <button
              onClick={() => onApplyCodeSuggestion(data.completedCode)}
              className="h-7 px-2.5 rounded-md border border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 transition-colors"
            >
              Apply completion to editor
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-800/60 flex-shrink-0">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Sparkles style={{ width: 11, height: 11 }} className="text-white" />
        </div>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">AI Tutor</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Online</span>
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-4 min-h-0">
        <div className="space-y-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            <Wrench style={{ width: 10, height: 10 }} />
            Pair Programmer Actions
          </div>
          <input
            value={actionPrompt}
            onChange={(e) => setActionPrompt(e.target.value)}
            placeholder="Optional focus (e.g., optimize time complexity)"
            className="w-full h-7 px-2 rounded-md bg-slate-950/80 border border-slate-700/70 text-[11px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500/40"
          />
          <div className="grid grid-cols-1 gap-1.5">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              const isActionLoading = loading && activeAction === action.key;
              return (
                <button
                  key={action.key}
                  onClick={() => runAction(action.key)}
                  disabled={loading || !String(code || '').trim()}
                  className="text-left p-2 rounded-md border border-slate-700/60 bg-slate-900/70 hover:border-violet-500/40 hover:bg-violet-500/10 transition-all disabled:opacity-40"
                >
                  <div className="flex items-center gap-1.5 text-slate-200 text-[11px] font-semibold">
                    <Icon style={{ width: 11, height: 11 }} />
                    {action.title}
                    {isActionLoading && <span className="text-[10px] text-violet-300">Thinking...</span>}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{action.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {renderStructuredResult()}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 self-start ${
              msg.role === 'assistant'
                ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                : 'bg-indigo-600'
            }`}>
              {msg.role === 'assistant'
                ? <Sparkles style={{ width: 11, height: 11 }} className="text-white" />
                : <User style={{ width: 11, height: 11 }} className="text-white" />
              }
            </div>
            <div className={`max-w-[85%] rounded-xl px-3 py-2.5 text-[12px] ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'bg-slate-800/60 border border-slate-700/40 text-slate-200 rounded-tl-sm'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-xs max-w-none
                  prose-p:text-slate-200 prose-p:text-[12px] prose-p:leading-relaxed prose-p:my-1.5
                  prose-code:bg-slate-900/80 prose-code:border prose-code:border-slate-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px] prose-code:text-violet-300 prose-code:font-mono
                  prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700/50 prose-pre:rounded-lg prose-pre:text-[11px] prose-pre:p-3
                  prose-strong:text-white prose-strong:font-semibold
                  prose-headings:text-white prose-headings:font-semibold
                  prose-li:text-slate-300 prose-li:text-[12px]">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="leading-relaxed">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Sparkles style={{ width: 11, height: 11 }} className="text-white" />
            </div>
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl rounded-tl-sm px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-3 pb-2 flex gap-1.5 flex-wrap flex-shrink-0">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p}
            onClick={() => sendMessage(p)}
            disabled={loading}
            className="text-[10px] px-2.5 py-1 rounded-full border border-slate-700/60 text-slate-500 hover:text-slate-200 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all disabled:opacity-30"
          >
            <Zap style={{ width: 9, height: 9 }} className="inline mr-1" />
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800/80 rounded-xl px-3 py-2 focus-within:border-violet-500/30 transition-colors">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask AI about your code..."
            className="flex-1 bg-transparent text-[12px] text-slate-200 placeholder:text-slate-600 outline-none"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-6 h-6 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send style={{ width: 11, height: 11 }} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}