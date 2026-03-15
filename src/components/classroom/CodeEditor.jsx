import React, { useState, useRef } from 'react';
import { Play, Send, Copy, RotateCcw, ChevronDown, Check, Loader2, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import StepByStepVisualizer from './StepByStepVisualizer';

const languages = [
  { value: 'javascript', label: 'JavaScript', ext: 'js',   color: '#facc15' },
  { value: 'python',     label: 'Python',     ext: 'py',   color: '#60a5fa' },
  { value: 'java',       label: 'Java',       ext: 'java', color: '#fb923c' },
  { value: 'cpp',        label: 'C++',        ext: 'cpp',  color: '#22d3ee' },
  { value: 'typescript', label: 'TypeScript', ext: 'ts',   color: '#38bdf8' },
  { value: 'go',         label: 'Go',         ext: 'go',   color: '#2dd4bf' },
  { value: 'rust',       label: 'Rust',       ext: 'rs',   color: '#fb7185' },
];

const defaultCode = {
  javascript: `// Welcome to CodeClass.ai\nfunction solution(nums) {\n  // Write your solution here\n  \n}\n\nconsole.log(solution([1, 2, 3]));`,
  python:     `# Welcome to CodeClass.ai\ndef solution(nums):\n    # Write your solution here\n    pass\n\nprint(solution([1, 2, 3]))`,
  java:       `// Welcome to CodeClass.ai\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}`,
  cpp:        `// Welcome to CodeClass.ai\n#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}`,
  typescript: `// Welcome to CodeClass.ai\nfunction solution(nums: number[]): number {\n  // Write your solution here\n  return 0;\n}\n\nconsole.log(solution([1, 2, 3]));`,
  go:         `// Welcome to CodeClass.ai\npackage main\n\nimport "fmt"\n\nfunc main() {\n    // Write your solution here\n    fmt.Println("Hello")\n}`,
  rust:       `// Welcome to CodeClass.ai\nfn main() {\n    // Write your solution here\n    println!("Hello, world!");\n}`,
};

export default function CodeEditor({ language, onLanguageChange, code, onCodeChange, onRun, onSubmit, isRunning }) {
  const [copied, setCopied] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const textareaRef = useRef(null);
  const currentLang = languages.find(l => l.value === language) || languages[0];
  const displayCode = code !== undefined && code !== '' ? code : (defaultCode[language] || defaultCode.javascript);
  const lineCount = displayCode.split('\n').length;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleReset = () => {
    onCodeChange(defaultCode[language] || defaultCode.javascript);
  };

  // Handle tab key in textarea
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = displayCode.substring(0, start) + '  ' + displayCode.substring(end);
      onCodeChange(newCode);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-xl border border-slate-800/50 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-slate-800/50 bg-slate-950/60 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/70 hover:bg-rose-500 transition-colors cursor-pointer" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70 hover:bg-amber-500 transition-colors cursor-pointer" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 hover:bg-emerald-500 transition-colors cursor-pointer" />
          </div>
          <span className="text-[11px] text-slate-500 font-mono ml-0.5 truncate">
            main.{currentLang.ext}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 gap-1.5 font-mono px-2 sm:px-2.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: currentLang.color }} />
                <span className="hidden sm:inline">{currentLang.label}</span>
                <span className="sm:hidden">{currentLang.ext.toUpperCase()}</span>
                <ChevronDown style={{ width: 11, height: 11 }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-900 border-slate-700/80 shadow-2xl" align="end">
              {languages.map(lang => (
                <DropdownMenuItem
                  key={lang.value}
                  onClick={() => { onLanguageChange(lang.value); onCodeChange(defaultCode[lang.value]); }}
                  className="text-slate-300 hover:text-white focus:text-white focus:bg-slate-800 text-[12px] gap-2.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: lang.color }} />
                  {lang.label}
                  {lang.value === language && <Check style={{ width: 11, height: 11 }} className="ml-auto text-indigo-400" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-slate-500 hover:text-white hover:bg-slate-800"
            onClick={handleCopy}
            title="Copy code"
          >
            {copied
              ? <Check style={{ width: 13, height: 13 }} className="text-emerald-400" />
              : <Copy style={{ width: 13, height: 13 }} />
            }
          </Button>

          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-slate-500 hover:text-white hover:bg-slate-800"
            onClick={handleReset}
            title="Reset code"
          >
            <RotateCcw style={{ width: 13, height: 13 }} />
          </Button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Line numbers */}
        <div className="select-none border-r border-slate-800/40 bg-slate-950/40 py-4 min-w-[44px] flex-shrink-0 overflow-hidden">
          {[...Array(Math.max(lineCount, 24))].map((_, i) => (
            <div key={i} className="text-[11px] text-slate-700 font-mono leading-6 h-6 pr-3 text-right tabular-nums">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={displayCode}
          onChange={(e) => onCodeChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-slate-200 p-4 resize-none outline-none font-mono text-[13px] leading-6 overflow-auto"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />
      </div>

      {/* Status bar / actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-2 border-t border-slate-800/50 bg-slate-950/60 flex-shrink-0 gap-2">
        <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono text-slate-600">
          <span className="flex items-center gap-1">
            <span className="text-slate-700">Ln</span> {lineCount}
          </span>
          <span className="w-px h-3 bg-slate-800" />
          <span style={{ color: currentLang.color }}>{currentLang.label}</span>
          <span className="w-px h-3 bg-slate-800" />
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
          <Button
            onClick={() => setShowVisualizer(true)}
            size="sm"
            className="h-7 px-2 sm:px-3 bg-purple-600/90 hover:bg-purple-600 text-white text-[11px] font-semibold gap-1.5 shadow-sm"
          >
            <Bug style={{ width: 11, height: 11 }} />
            <span className="hidden sm:inline">Debug</span>
          </Button>
          <Button
            onClick={onRun}
            disabled={isRunning}
            size="sm"
            className="h-7 px-2 sm:px-3 bg-emerald-600/90 hover:bg-emerald-600 text-white text-[11px] font-semibold gap-1.5 shadow-sm"
          >
            {isRunning
              ? <><Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> <span className="hidden sm:inline">Running</span></>
              : <><Play style={{ width: 11, height: 11 }} /> <span className="hidden sm:inline">Run Code</span></>
            }
          </Button>
          <Button
            onClick={onSubmit}
            size="sm"
            className="h-7 px-2 sm:px-3 bg-indigo-600/90 hover:bg-indigo-600 text-white text-[11px] font-semibold gap-1.5 shadow-sm"
          >
            <Send style={{ width: 11, height: 11 }} />
            <span className="hidden sm:inline">Submit</span>
          </Button>
        </div>
      </div>

      {/* Step-by-step visualizer */}
      {showVisualizer && (
        <StepByStepVisualizer 
          code={displayCode}
          language={language}
          onClose={() => setShowVisualizer(false)}
        />
      )}
    </div>
  );
}