// @ts-nocheck
/* eslint-disable react/prop-types */
/**
 * Version History Panel
 * UI for viewing, comparing, and restoring code versions
 * Provides comprehensive version control interface
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import versionControl from '@/services/versionControl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  History, 
  RotateCcw, 
  GitBranch, 
  Clock, 
  Eye, 
  Download, 
  Bookmark,
  Code2,
  Save,
  Loader2,
  Diff
} from 'lucide-react';

export default function VersionHistoryPanel({ classroomId, userEmail, currentCode, currentLanguage, onRestoreCode }) {
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [expandedVersion, setExpandedVersion] = useState(null);
  const [showDiff, setShowDiff] = useState(false);
  const [diffData, setDiffData] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showCreateCheckpoint, setShowCreateCheckpoint] = useState(false);
  const [checkpointDescription, setCheckpointDescription] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);

  // Load version history
  const { data: versions = [], isLoading, refetch } = useQuery({
    queryKey: ['versionHistory', classroomId, userEmail],
    queryFn: () => versionControl.getVersionHistory(classroomId, userEmail),
    enabled: !!classroomId && !!userEmail,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Initialize version control on component mount
  useEffect(() => {
    if (classroomId && userEmail) {
      versionControl.initializeVersionControl(classroomId, userEmail);
    }
  }, [classroomId, userEmail]);

  const handleRestoreVersion = async (versionId) => {
    setIsRestoring(true);
    try {
      const result = await versionControl.restoreVersion(versionId, classroomId, userEmail);
      
      if (result.success) {
        onRestoreCode(result.code, result.language);
        refetch(); // Refresh version history
      } else {
        alert(`Failed to restore version: ${result.error}`);
      }
    } catch (error) {
      console.error('Restore failed:', error);
      alert('Failed to restore version');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCreateCheckpoint = async () => {
    if (!checkpointDescription.trim()) return;
    
    try {
      await versionControl.createCheckpoint(
        classroomId, 
        userEmail, 
        currentCode, 
        currentLanguage, 
        checkpointDescription
      );
      
      setCheckpointDescription('');
      setShowCreateCheckpoint(false);
      refetch();
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
      alert('Failed to create checkpoint');
    }
  };

  const handleCompareVersions = async () => {
    if (selectedVersions.length !== 2) return;
    
    try {
      const comparison = await versionControl.compareVersions(
        selectedVersions[0], 
        selectedVersions[1], 
        classroomId, 
        userEmail
      );
      
      if (comparison) {
        setDiffData(comparison);
        setShowDiff(true);
      }
    } catch (error) {
      console.error('Comparison failed:', error);
      alert('Failed to compare versions');
    }
  };

  const handleExportHistory = async () => {
    try {
      const exportData = await versionControl.exportVersionHistory(classroomId, userEmail);
      if (exportData) {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `version-history-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export version history');
    }
  };

  const handleCleanupHistory = async () => {
    const confirmed = globalThis.window?.confirm(
      'Remove old auto-snapshots and enforce version retention for this classroom history?'
    );

    if (!confirmed) {
      return;
    }

    setIsCleaning(true);

    try {
      const retention = await versionControl.cleanupVersionHistory(classroomId, userEmail, {
        maxTotalHistory: 200,
        maxAutoSnapshots: 120
      });

      if (retention) {
        refetch();
        alert(`Cleanup complete. Removed ${retention.removed_count} old snapshots.`);
      } else {
        alert('Cleanup completed.');
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
      alert(error.message || 'Failed to cleanup version history');
    } finally {
      setIsCleaning(false);
    }
  };

  const toggleVersionSelection = (versionId) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      } else if (prev.length < 2) {
        return [...prev, versionId];
      } else {
        return [prev[1], versionId]; // Replace oldest selection
      }
    });
  };

  const getVersionIcon = (type) => {
    switch (type) {
      case 'submission': return <Save className="w-4 h-4 text-green-400" />;
      case 'checkpoint': return <Bookmark className="w-4 h-4 text-blue-400" />;
      case 'auto': return <Clock className="w-4 h-4 text-slate-400" />;
      default: return <Code2 className="w-4 h-4 text-purple-400" />;
    }
  };

  const getVersionColor = (type) => {
    switch (type) {
      case 'submission': return 'bg-green-500/20 border-green-500/50 text-green-300';
      case 'checkpoint': return 'bg-blue-500/20 border-blue-500/50 text-blue-300';
      case 'auto': return 'bg-slate-500/20 border-slate-500/50 text-slate-300';
      default: return 'bg-purple-500/20 border-purple-500/50 text-purple-300';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getDiffLineClassName = (lineType) => {
    if (lineType === 'added') return 'bg-green-500/20 text-green-300';
    if (lineType === 'removed') return 'bg-red-500/20 text-red-300';
    if (lineType === 'modified') return 'bg-orange-500/20 text-orange-300';
    return 'text-slate-400';
  };

  const getDiffMarker = (lineType) => {
    if (lineType === 'added') return '+';
    if (lineType === 'removed') return '-';
    if (lineType === 'modified') return '~';
    return ' ';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 border border-slate-700 rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Version History</h3>
          </div>
          <Badge variant="outline" className="text-slate-400">
            {versions.length} versions
          </Badge>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showCreateCheckpoint} onOpenChange={setShowCreateCheckpoint}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-xs">
                <Bookmark className="w-3 h-3 mr-1" />
                Checkpoint
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Create Checkpoint</DialogTitle>
                <DialogDescription>
                  Save the current code state with a custom description
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter checkpoint description..."
                  value={checkpointDescription}
                  onChange={(e) => setCheckpointDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
                <div className="flex gap-2">
                  <Button onClick={handleCreateCheckpoint} disabled={!checkpointDescription.trim()}>
                    Create
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCreateCheckpoint(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleCompareVersions}
            disabled={selectedVersions.length !== 2}
            className="text-xs"
          >
            <Diff className="w-3 h-3 mr-1" />
            Compare ({selectedVersions.length}/2)
          </Button>

          <Button size="sm" variant="outline" onClick={handleExportHistory} className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Export
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCleanupHistory}
            disabled={isCleaning || versions.length === 0}
            className="text-xs"
          >
            <GitBranch className="w-3 h-3 mr-1" />
            {isCleaning ? 'Cleaning...' : 'Cleanup'}
          </Button>
        </div>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {versions.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No version history yet</p>
            <p className="text-xs mt-1">Code will be auto-saved as you work</p>
          </div>
        ) : (
          versions.map((version, index) => (
            <Card 
              key={version.id} 
              className={`bg-slate-800 border-slate-700 hover:bg-slate-750 transition-colors cursor-pointer ${
                selectedVersions.includes(version.id) ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => toggleVersionSelection(version.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      {getVersionIcon(version.version_type)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {version.description}
                          </span>
                          <Badge className={`text-xs ${getVersionColor(version.version_type)}`}>
                            {version.version_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                          <span>{formatTimestamp(version.timestamp)}</span>
                          <span>{version.language}</span>
                          <span>{version.code_content?.length || 0} chars</span>
                          {version.metadata && JSON.parse(version.metadata).line_count && (
                            <span>{JSON.parse(version.metadata).line_count} lines</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {index > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedVersion(expandedVersion === version.id ? null : version.id);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreVersion(version.id);
                      }}
                      disabled={isRestoring}
                      className="h-8 w-8 p-0"
                    >
                      {isRestoring ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded version content */}
                {expandedVersion === version.id && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="bg-slate-950 rounded p-3 max-h-40 overflow-auto">
                      <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                        {version.code_content}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Diff modal */}
      <Dialog open={showDiff} onOpenChange={setShowDiff}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Version Comparison</DialogTitle>
            <DialogDescription>
              {diffData && `Comparing ${formatTimestamp(diffData.version1.timestamp)} with ${formatTimestamp(diffData.version2.timestamp)}`}
            </DialogDescription>
          </DialogHeader>
          
          {diffData && (
            <div className="space-y-4 overflow-auto">
              {/* Statistics */}
              <div className="flex gap-4 text-sm bg-slate-750 p-3 rounded">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-green-300">+{diffData.statistics.linesAdded} added</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-red-300">-{diffData.statistics.linesRemoved} removed</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span className="text-orange-300">~{diffData.statistics.linesModified} modified</span>
                </div>
              </div>

              {/* Diff view */}
              <div className="bg-slate-950 rounded p-4 max-h-96 overflow-auto">
                {diffData.diff.map((line) => (
                  <div key={`${line.lineNumber}-${line.type}-${line.line || line.oldLine || line.newLine || ''}`} className={`flex font-mono text-xs py-0.5 ${getDiffLineClassName(line.type)}`}>
                    <span className="w-12 text-right pr-2 text-slate-600">
                      {line.lineNumber}
                    </span>
                    <span className="w-4 text-center">
                      {getDiffMarker(line.type)}
                    </span>
                    <span className="flex-1">
                      {line.type === 'modified' ? (
                        <>
                          <div className="text-red-300">- {line.oldLine}</div>
                          <div className="text-green-300">+ {line.newLine}</div>
                        </>
                      ) : (
                        line.line || line.oldLine || line.newLine
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}