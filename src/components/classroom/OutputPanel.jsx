import React from 'react';
import PropTypes from 'prop-types';
import { Terminal, CheckCircle2, XCircle, Loader2, Play, Eraser } from 'lucide-react';

export default function OutputPanel({
  output,
  isRunning,
  error,
  inputValue = '',
  onInputChange = () => {},
  onRun = () => {},
  language = 'javascript'
}) {
  const normalizedLanguage = String(language || 'javascript').toUpperCase();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/60 flex-shrink-0 bg-[#0b1320]">
        <Terminal style={{ width: 13, height: 13 }} className="text-slate-500" />
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Output</span>
        <span className="ml-1 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
          {normalizedLanguage}
        </span>
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
      <div className="flex-1 overflow-auto p-3 font-mono text-[12px] min-h-0 select-text">
        <div className="mb-3 rounded-lg border border-slate-800/70 bg-[#0b1320] p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="stdin-input" className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Program Input (stdin)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onInputChange('')}
                className="h-6 px-2 rounded border border-slate-700 text-[10px] text-slate-300 hover:text-white hover:border-slate-600 inline-flex items-center gap-1"
              >
                <Eraser style={{ width: 10, height: 10 }} />
                Clear
              </button>
              <button
                type="button"
                onClick={onRun}
                disabled={isRunning}
                className="h-6 px-2 rounded border border-emerald-500/50 bg-emerald-500/15 text-[10px] text-emerald-200 hover:bg-emerald-500/25 hover:text-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                {isRunning ? <Loader2 style={{ width: 10, height: 10 }} className="animate-spin" /> : <Play style={{ width: 10, height: 10 }} />}
                Run
              </button>
            </div>
          </div>
          <textarea
            id="stdin-input"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Example:\n5\n10 20"
            className="w-full min-h-[82px] max-h-36 resize-y rounded-md border border-slate-700 bg-[#0a0f1a] p-2 text-[11px] text-slate-200 outline-none focus:border-emerald-500/60"
            spellCheck={false}
          />
          <p className="mt-1.5 text-[10px] text-slate-500">
            Enter each input token on new line or space-separated format as required by your code.
          </p>
        </div>

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
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Program Output</span>
            </div>
            <pre className="text-emerald-300/90 whitespace-pre-wrap leading-6 text-[12px] select-text cursor-text">{output}</pre>
          </div>
        )}

        {error && !isRunning && (
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-rose-500/20">
              <XCircle style={{ width: 12, height: 12 }} className="text-rose-400" />
              <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">Error Details</span>
            </div>
            <pre className="text-rose-300/90 whitespace-pre-wrap leading-6 text-[12px] select-text cursor-text">{error}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

OutputPanel.propTypes = {
  output: PropTypes.string,
  isRunning: PropTypes.bool,
  error: PropTypes.string,
  inputValue: PropTypes.string,
  onInputChange: PropTypes.func,
  onRun: PropTypes.func,
  language: PropTypes.string
};