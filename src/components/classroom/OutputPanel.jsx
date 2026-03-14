import React from 'react';
import { Terminal, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function OutputPanel({ output, isRunning, error }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/60 flex-shrink-0">
        <Terminal style={{ width: 13, height: 13 }} className="text-slate-500" />
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Output</span>
        {isRunning && (
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-amber-400">
            <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />
            Executing...
          </div>
        )}
        {output && !isRunning && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
            <CheckCircle2 style={{ width: 11, height: 11 }} />
            Success
          </div>
        )}
        {error && !isRunning && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-rose-400">
            <XCircle style={{ width: 11, height: 11 }} />
            Error
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 font-mono text-[12px] min-h-0">
        {!output && !error && !isRunning && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-700">
            <Terminal style={{ width: 28, height: 28 }} className="text-slate-800" />
            <div className="text-center">
              <p className="text-[11px] text-slate-600">No output yet</p>
              <p className="text-[10px] text-slate-700 mt-0.5">Click "Run Code" to execute</p>
            </div>
          </div>
        )}

        {isRunning && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Loader2 style={{ width: 16, height: 16 }} className="animate-spin text-amber-400" />
            </div>
            <p className="text-[11px] text-amber-400">Running your code...</p>
          </div>
        )}

        {output && !isRunning && (
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800/60">
              <CheckCircle2 style={{ width: 12, height: 12 }} className="text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Execution Output</span>
            </div>
            <pre className="text-emerald-300/90 whitespace-pre-wrap leading-6 text-[12px]">{output}</pre>
          </div>
        )}

        {error && !isRunning && (
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-rose-500/20">
              <XCircle style={{ width: 12, height: 12 }} className="text-rose-400" />
              <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">Runtime Error</span>
            </div>
            <pre className="text-rose-300/90 whitespace-pre-wrap leading-6 text-[12px]">{error}</pre>
          </div>
        )}
      </div>
    </div>
  );
}