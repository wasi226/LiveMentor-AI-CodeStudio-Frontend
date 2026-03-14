import React, { useState, useRef, useEffect } from 'react';
import { Send, Hash } from 'lucide-react';
import moment from 'moment';

export default function ChatPanel({ messages, currentUser, onSendMessage }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const getInitials = (email, name) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return (email || '?')[0].toUpperCase();
  };

  const bubbleGradients = [
    'from-indigo-500 to-violet-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-sky-500 to-blue-600',
  ];

  const getGradient = (email) => {
    let hash = 0;
    for (let c of (email || '')) hash = (hash << 5) - hash + c.charCodeAt(0);
    return bubbleGradients[Math.abs(hash) % bubbleGradients.length];
  };

  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/60 flex-shrink-0">
        <Hash style={{ width: 13, height: 13 }} className="text-slate-600" />
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">classroom-chat</span>
        <span className="ml-auto text-[10px] text-slate-700">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2">
              <Hash style={{ width: 14, height: 14 }} className="text-slate-600" />
            </div>
            <p className="text-[11px] text-slate-600">No messages yet. Say hello!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.sender_email === currentUser?.email;
          const showSender = !isMe && (i === 0 || messages[i - 1]?.sender_email !== msg.sender_email);
          const gradient = getGradient(msg.sender_email);

          return (
            <div key={msg.id || i} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 mt-0.5 self-end`}>
                  <span className="text-[9px] text-white font-semibold">
                    {getInitials(msg.sender_email, msg.sender_name)}
                  </span>
                </div>
              )}
              <div className={`max-w-[78%] space-y-0.5 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {showSender && (
                  <span className="text-[10px] text-slate-500 px-1">{msg.sender_name || msg.sender_email?.split('@')[0]}</span>
                )}
                <div className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                  isMe
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : msg.type === 'ai_response'
                      ? 'bg-violet-500/12 border border-violet-500/20 text-violet-200 rounded-tl-sm'
                      : 'bg-slate-800/80 text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.type === 'code'
                    ? <pre className="font-mono text-[11px] whitespace-pre-wrap">{msg.message}</pre>
                    : <p className="whitespace-pre-wrap">{msg.message}</p>
                  }
                </div>
                <span className="text-[10px] text-slate-700 px-1">
                  {moment(msg.created_date).format('h:mm A')}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800/80 rounded-xl px-3 py-2 focus-within:border-slate-700 transition-colors">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Message classroom..."
            className="flex-1 bg-transparent text-[12px] text-slate-200 placeholder:text-slate-600 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send style={{ width: 11, height: 11 }} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}