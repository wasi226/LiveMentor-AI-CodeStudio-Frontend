import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, User, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const QUICK_PROMPTS = [
  'Explain this code',
  'Find bugs',
  'Optimize it',
  'Add comments',
];

export default function AIAssistant({ code, language }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hello! I'm your AI coding tutor for **${language}**. I can help you debug, explain concepts, optimize your code, or answer any questions. What would you like to work on?` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Mock AI response
      const response = 'AI Assistant functionality is currently disabled. This is a mock response to your question about: ' + userMsg;

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('AI Assistant Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error while processing your request. Please try again or check your connection.' 
      }]);
    } finally {
      setLoading(false);
    }
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
          Online
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
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