/**
 * Step-by-Step Code Execution Visualizer
 * Educational tool for teaching programming concepts
 * Shows execution flow, variable states, and memory changes
 */

import React, { useState, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, RotateCcw, Bug, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

class ExecutionVisualizer {
  constructor() {
    this.steps = [];
    this.currentStep = 0;
    this.variables = new Map();
    this.callStack = [];
    this.memory = [];
    this.isRunning = false;
  }

  /**
   * Parse code and create execution steps
   */
  parseCode(code, language) {
    const lines = code.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));
    const steps = [];
    let lineNumber = 0;
    
    // Simple parsing for demonstration - can be enhanced for full language support
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineNumber = i + 1;
      
      if (this.isExecutableLine(line, language)) {
        steps.push({
          id: steps.length,
          lineNumber,
          code: line,
          type: this.getStatementType(line, language),
          variables: new Map(),
          memory: [],
          callStack: [],
          explanation: this.getLineExplanation(line, language)
        });
      }
    }
    
    return steps;
  }

  /**
   * Check if line is executable (not comment, empty, etc.)
   */
  isExecutableLine(line, language) {
    if (!line.trim()) return false;
    
    switch (language) {
      case 'python':
        return !line.startsWith('#') && !line.startsWith('"""') && !line.startsWith("'''");
      case 'javascript':
      case 'typescript':
        return !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*');
      case 'java':
      case 'cpp':
        return !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') && !line.startsWith('#');
      default:
        return true;
    }
  }

  /**
   * Determine statement type for visualization
   */
  getStatementType(line, language) {
    const trimmed = line.trim().toLowerCase();
    
    // Variable declarations
    if (trimmed.includes('=') && !trimmed.includes('==') && !trimmed.includes('!=')) {
      return 'assignment';
    }
    
    // Control flow
    if (trimmed.startsWith('if') || trimmed.startsWith('elif') || trimmed.startsWith('else')) {
      return 'conditional';
    }
    if (trimmed.startsWith('for') || trimmed.startsWith('while')) {
      return 'loop';
    }
    if (trimmed.startsWith('function') || trimmed.startsWith('def')) {
      return 'function_declaration';
    }
    if (trimmed.includes('(') && trimmed.includes(')')) {
      return 'function_call';
    }
    
    // Output statements
    if (trimmed.includes('print') || trimmed.includes('console.log')) {
      return 'output';
    }
    
    return 'statement';
  }

  /**
   * Generate explanation for each line
   */
  getLineExplanation(line, language) {
    const type = this.getStatementType(line, language);
    
    switch (type) {
      case 'assignment':
        return `Assigning a value to a variable. The computer stores this value in memory.`;
      case 'conditional':
        return `Checking a condition. The computer decides which path to take based on true/false.`;
      case 'loop':
        return `Starting a loop. The computer will repeat the following code block.`;
      case 'function_call':
        return `Calling a function. The computer jumps to execute the function code.`;
      case 'output':
        return `Displaying output. The computer shows the result to the user.`;
      case 'function_declaration':
        return `Defining a function. The computer remembers this code to run later.`;
      default:
        return `Executing a statement. The computer processes this instruction.`;
    }
  }

  /**
   * Simulate variable extraction from code line
   */
  extractVariables(line, language) {
    const variables = new Map();
    
    // Simple variable extraction - can be enhanced
    const assignmentMatch = line.match(/(\w+)\s*=\s*(.+)/);
    if (assignmentMatch) {
      const [, varName, value] = assignmentMatch;
      
      // Try to evaluate the value
      let evaluatedValue;
      if (value.match(/^\d+$/)) {
        evaluatedValue = parseInt(value);
      } else if (value.match(/^\d+\.\d+$/)) {
        evaluatedValue = parseFloat(value);
      } else if (value.match(/^["'].*["']$/)) {
        evaluatedValue = value.slice(1, -1);
      } else {
        evaluatedValue = value; // Keep as string for complex expressions
      }
      
      variables.set(varName, {
        value: evaluatedValue,
        type: typeof evaluatedValue,
        line: line
      });
    }
    
    return variables;
  }

  /**
   * Simulate memory changes
   */
  simulateMemoryChanges(step, previousStep) {
    const memory = previousStep ? [...previousStep.memory] : [];
    
    // Add memory allocation for new variables
    step.variables.forEach((varInfo, varName) => {
      const existingIndex = memory.findIndex(m => m.name === varName);
      if (existingIndex >= 0) {
        // Update existing variable
        memory[existingIndex] = {
          name: varName,
          value: varInfo.value,
          type: varInfo.type,
          address: memory[existingIndex].address
        };
      } else {
        // Allocate new memory
        memory.push({
          name: varName,
          value: varInfo.value,
          type: varInfo.type,
          address: `0x${Math.random().toString(16).substr(2, 8).toUpperCase()}`
        });
      }
    });
    
    return memory;
  }
}

export default function StepByStepVisualizer({ code, language, onClose }) {
  const [visualizer] = useState(() => new ExecutionVisualizer());
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000); // milliseconds
  const [showMemory, setShowMemory] = useState(true);
  const [showCallStack, setShowCallStack] = useState(true);
  const intervalRef = useRef(null);

  // Initialize steps when code changes
  React.useEffect(() => {
    if (code && language) {
      const parsedSteps = visualizer.parseCode(code, language);
      
      // Simulate execution and populate variable states
      const enhancedSteps = parsedSteps.map((step, index) => {
        const previousStep = index > 0 ? parsedSteps[index - 1] : null;
        
        // Extract variables from current line
        const newVariables = visualizer.extractVariables(step.code, language);
        
        // Merge with previous variables
        const allVariables = new Map();
        if (previousStep) {
          previousStep.variables.forEach((value, key) => allVariables.set(key, value));
        }
        newVariables.forEach((value, key) => allVariables.set(key, value));
        
        // Simulate memory state
        const memory = visualizer.simulateMemoryChanges({ variables: allVariables }, previousStep);
        
        return {
          ...step,
          variables: allVariables,
          memory
        };
      });
      
      setSteps(enhancedSteps);
      setCurrentStep(0);
    }
  }, [code, language, visualizer]);

  const startAutoPlay = useCallback(() => {
    if (intervalRef.current) return;
    
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          return prev;
        }
        return prev + 1;
      });
    }, playSpeed);
  }, [playSpeed, steps.length]);

  const stopAutoPlay = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const goToStep = useCallback((stepIndex) => {
    stopAutoPlay();
    setCurrentStep(Math.max(0, Math.min(stepIndex, steps.length - 1)));
  }, [stopAutoPlay, steps.length]);

  const reset = useCallback(() => {
    stopAutoPlay();
    setCurrentStep(0);
  }, [stopAutoPlay]);

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const currentStepData = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#0d1117] rounded-xl border border-slate-800 w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Bug className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Step-by-Step Execution</h2>
            <span className="text-sm text-slate-400">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={playSpeed} 
              onChange={(e) => setPlaySpeed(Number(e.target.value))}
              className="bg-slate-800 text-white text-sm px-2 py-1 rounded border border-slate-700"
            >
              <option value={2000}>Slow (2s)</option>
              <option value={1000}>Normal (1s)</option>
              <option value={500}>Fast (0.5s)</option>
            </select>
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Code panel */}
          <div className="flex-1 bg-slate-950 border-r border-slate-800">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-300">Code Execution</h3>
            </div>
            <div className="p-4 overflow-auto h-full">
              {code.split('\n').map((line, index) => {
                const isCurrentLine = currentStepData && currentStepData.lineNumber === index + 1;
                const isExecuted = steps.some(step => step.lineNumber === index + 1 && steps.indexOf(step) <= currentStep);
                
                return (
                  <div 
                    key={index}
                    className={`flex items-start gap-3 py-1 px-2 rounded ${
                      isCurrentLine ? 'bg-blue-500/20 border-l-2 border-blue-400' :
                      isExecuted ? 'bg-green-500/10' : ''
                    }`}
                  >
                    <span className="text-slate-600 text-xs font-mono w-8 text-right">
                      {index + 1}
                    </span>
                    <code className="text-sm font-mono text-slate-200 flex-1">
                      {line || ' '}
                    </code>
                    {isCurrentLine && (
                      <span className="text-blue-400 text-xs">← Current</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visualization panel */}
          <div className="w-96 bg-slate-900 flex flex-col">
            {/* Variables */}
            <div className="flex-1 border-b border-slate-800">
              <div className="p-3 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300">Variables</h3>
              </div>
              <div className="p-3 space-y-2 overflow-auto">
                {currentStepData && currentStepData.variables.size > 0 ? (
                  Array.from(currentStepData.variables.entries()).map(([name, info]) => (
                    <div key={name} className="bg-slate-800/50 rounded px-3 py-2">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-300 font-mono text-sm">{name}</span>
                        <span className="text-xs text-slate-500">{info.type}</span>
                      </div>
                      <div className="text-green-300 font-mono text-sm mt-1">
                        {JSON.stringify(info.value)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No variables yet</p>
                )}
              </div>
            </div>

            {/* Memory visualization */}
            {showMemory && (
              <div className="flex-1">
                <div className="p-3 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-300">Memory</h3>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowMemory(false)}
                  >
                    <EyeOff className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-3 space-y-1 overflow-auto text-xs font-mono">
                  {currentStepData && currentStepData.memory.length > 0 ? (
                    currentStepData.memory.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-1">
                        <span className="text-slate-400">{item.address}</span>
                        <span className="text-blue-300">{item.name}</span>
                        <span className="text-green-300">{JSON.stringify(item.value)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500">No memory allocated</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={currentStep === 0}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToStep(currentStep - 1)}
                disabled={currentStep === 0}
              >
                &#8592; Prev
              </Button>

              <Button
                onClick={isPlaying ? stopAutoPlay : startAutoPlay}
                disabled={currentStep >= steps.length - 1}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToStep(currentStep + 1)}
                disabled={currentStep >= steps.length - 1}
              >
                Next &#8594;
              </Button>
            </div>

            {/* Step explanation */}
            {currentStepData && (
              <div className="flex-1 mx-6">
                <p className="text-sm text-slate-300 text-center">
                  {currentStepData.explanation}
                </p>
              </div>
            )}

            {/* Progress */}
            <div className="text-sm text-slate-400">
              Progress: {Math.round(((currentStep + 1) / steps.length) * 100)}%
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 bg-slate-800 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}