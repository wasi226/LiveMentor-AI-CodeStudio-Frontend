/**
 * Code Version Control System
 * Provides auto-save, version history, rollback capabilities,
 * and submission tracking for educational coding platform
 */

class CodeVersionControl {
  constructor() {
    this.autoSaveInterval = 30000; // Auto-save every 30 seconds
    this.maxVersions = 50; // Keep last 50 versions
    this.minChangeThreshold = 10; // Minimum characters changed to save version
    this.autoSaveTimer = null;
    this.pendingChanges = false;
  }

  /**
   * Initialize version control for a classroom session
   */
  async initializeVersionControl(classroomId, userEmail) {
    try {
      // Create initial version if none exists
      const existingVersions = await this.getVersionHistory(classroomId, userEmail);
      
      if (existingVersions.length === 0) {
        await this.saveVersion(classroomId, userEmail, '', 'javascript', 'initial', 'Session started');
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize version control:', error);
      return false;
    }
  }

  /**
   * Save a new code version
   */
  async saveVersion(classroomId, userEmail, code, language, type = 'auto', description = '') {
    try {
      // Create version metadata
      const versionData = {
        classroom_id: classroomId,
        user_email: userEmail,
        code_content: code,
        language,
        version_type: type, // 'auto', 'manual', 'checkpoint', 'submission'
        description: description || this.generateAutoDescription(type),
        metadata: JSON.stringify({
          code_length: code.length,
          line_count: code.split('\n').length,
          timestamp: Date.now(),
          change_summary: this.analyzeChanges(code)
        })
      };

      // Mock version saving - disabled
      const version = {
        id: Date.now().toString(),
        created_date: new Date().toISOString()
      };

      // Clean up old versions if exceeded limit (mock)
      console.log('Version cleanup would run here');

      return {
        id: version.id,
        timestamp: version.created_date,
        ...versionData
      };

    } catch (error) {
      console.error('Failed to save version:', error);
      return null;
    }
  }

  /**
   * Get version history for a user in a classroom
   */
  async getVersionHistory(classroomId, userEmail, limit = 50) {
    try {
      // Mock version history - disabled
      const messages = [];

      // Parse and sort versions
      const versions = messages
        .map(msg => {
          try {
            const versionData = JSON.parse(msg.metadata);
            return {
              id: msg.id,
              timestamp: msg.created_date,
              description: msg.message,
              ...versionData
            };
          } catch (e) {
            return null;
          }
        })
        .filter(v => v !== null)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return versions;

    } catch (error) {
      console.error('Failed to get version history:', error);
      return [];
    }
  }

  /**
   * Restore code from a specific version
   */
  async restoreVersion(versionId, classroomId, userEmail) {
    try {
      const versions = await this.getVersionHistory(classroomId, userEmail);
      const targetVersion = versions.find(v => v.id === versionId);

      if (!targetVersion) {
        throw new Error('Version not found');
      }

      // Create a restoration checkpoint before restoring
      const currentCode = await this.getCurrentCode(classroomId, userEmail);
      if (currentCode) {
        await this.saveVersion(
          classroomId, 
          userEmail, 
          currentCode.code, 
          currentCode.language, 
          'checkpoint', 
          'Pre-restoration backup'
        );
      }

      // Return the code content to restore
      return {
        code: targetVersion.code_content,
        language: targetVersion.language,
        version: targetVersion,
        success: true
      };

    } catch (error) {
      console.error('Failed to restore version:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Compare two versions and show differences
   */
  async compareVersions(versionId1, versionId2, classroomId, userEmail) {
    try {
      const versions = await this.getVersionHistory(classroomId, userEmail);
      const version1 = versions.find(v => v.id === versionId1);
      const version2 = versions.find(v => v.id === versionId2);

      if (!version1 || !version2) {
        throw new Error('One or more versions not found');
      }

      const diff = this.generateDiff(version1.code_content, version2.code_content);
      
      return {
        version1: version1,
        version2: version2,
        diff: diff,
        statistics: {
          linesAdded: diff.filter(d => d.type === 'added').length,
          linesRemoved: diff.filter(d => d.type === 'removed').length,
          linesModified: diff.filter(d => d.type === 'modified').length
        }
      };

    } catch (error) {
      console.error('Failed to compare versions:', error);
      return null;
    }
  }

  /**
   * Start auto-save functionality
   */
  startAutoSave(classroomId, userEmail, getCurrentCodeFunc) {
    if (this.autoSaveTimer) {
      this.stopAutoSave();
    }

    this.autoSaveTimer = setInterval(async () => {
      if (this.pendingChanges) {
        try {
          const currentCode = await getCurrentCodeFunc();
          if (currentCode && currentCode.code.trim()) {
            
            // Check if changes are significant enough
            const lastVersion = await this.getLastVersion(classroomId, userEmail);
            
            if (this.shouldSaveVersion(currentCode.code, lastVersion?.code_content)) {
              await this.saveVersion(
                classroomId, 
                userEmail, 
                currentCode.code, 
                currentCode.language, 
                'auto'
              );
              this.pendingChanges = false;
            }
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, this.autoSaveInterval);
  }

  /**
   * Stop auto-save functionality
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Mark that changes are pending for auto-save
   */
  markPendingChanges() {
    this.pendingChanges = true;
  }

  /**
   * Create a manual checkpoint
   */
  async createCheckpoint(classroomId, userEmail, code, language, description) {
    return await this.saveVersion(classroomId, userEmail, code, language, 'checkpoint', description);
  }

  /**
   * Save submission version
   */
  async saveSubmissionVersion(classroomId, userEmail, code, language, submissionId) {
    return await this.saveVersion(
      classroomId, 
      userEmail, 
      code, 
      language, 
      'submission', 
      `Code submitted (ID: ${submissionId})`
    );
  }

  /**
   * Get submission history
   */
  async getSubmissionHistory(classroomId, userEmail) {
    const versions = await this.getVersionHistory(classroomId, userEmail);
    return versions.filter(v => v.version_type === 'submission');
  }

  /**
   * Get the most recent version
   */
  async getLastVersion(classroomId, userEmail) {
    const versions = await this.getVersionHistory(classroomId, userEmail, 1);
    return versions[0] || null;
  }

  /**
   * Get current code (placeholder - should be implemented based on app architecture)
   */
  async getCurrentCode(classroomId, userEmail) {
    // This would typically get the current code from the editor state
    // Implementation depends on how the app manages current code state
    return null;
  }

  /**
   * Determine if changes are significant enough to save
   */
  shouldSaveVersion(currentCode, lastVersionCode) {
    if (!lastVersionCode) return true;
    
    // Calculate edit distance/difference
    const sizeDiff = Math.abs(currentCode.length - lastVersionCode.length);
    const significantChange = sizeDiff >= this.minChangeThreshold;
    
    // Also check for structural changes (basic heuristic)
    const structuralChange = this.hasStructuralChanges(currentCode, lastVersionCode);
    
    return significantChange || structuralChange;
  }

  /**
   * Detect structural changes in code
   */
  hasStructuralChanges(code1, code2) {
    // Simple structural change detection
    const getStructuralTokens = (code) => {
      return code.match(/[{}();=]|if|else|for|while|function|def|class/g) || [];
    };
    
    const tokens1 = getStructuralTokens(code1);
    const tokens2 = getStructuralTokens(code2);
    
    return tokens1.length !== tokens2.length || 
           tokens1.join('') !== tokens2.join('');
  }

  /**
   * Generate automatic version description
   */
  generateAutoDescription(type) {
    const timestamp = new Date().toLocaleTimeString();
    
    switch (type) {
      case 'auto':
        return `Auto-saved at ${timestamp}`;
      case 'checkpoint':
        return `Manual checkpoint at ${timestamp}`;
      case 'submission':
        return `Code submitted at ${timestamp}`;
      default:
        return `Version saved at ${timestamp}`;
    }
  }

  /**
   * Analyze code changes for version metadata
   */
  analyzeChanges(code) {
    // Simple change analysis
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim());
    
    return {
      total_lines: lines.length,
      code_lines: nonEmptyLines.length,
      blank_lines: lines.length - nonEmptyLines.length,
      estimated_complexity: this.estimateComplexity(code)
    };
  }

  /**
   * Simple complexity estimation
   */
  estimateComplexity(code) {
    const controlStructures = (code.match(/if|else|for|while|switch|try|catch/g) || []).length;
    const functions = (code.match(/function|def |class /g) || []).length;
    return controlStructures + (functions * 2);
  }

  /**
   * Generate diff between two code versions
   */
  generateDiff(oldCode, newCode) {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    const diff = [];
    
    // Simple diff algorithm (can be enhanced with proper diff library)
    const maxLength = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (oldLine === newLine) {
        diff.push({ type: 'unchanged', line: oldLine, lineNumber: i + 1 });
      } else if (!oldLine && newLine) {
        diff.push({ type: 'added', line: newLine, lineNumber: i + 1 });
      } else if (oldLine && !newLine) {
        diff.push({ type: 'removed', line: oldLine, lineNumber: i + 1 });
      } else {
        diff.push({ type: 'modified', oldLine: oldLine, newLine: newLine, lineNumber: i + 1 });
      }
    }
    
    return diff;
  }

  /**
   * Clean up old versions to stay within limits
   */
  async cleanupOldVersions(classroomId, userEmail) {
    try {
      const versions = await this.getVersionHistory(classroomId, userEmail, 100);
      
      if (versions.length > this.maxVersions) {
        // Keep the most recent versions and some important ones (submissions, checkpoints)
        const versionsToKeep = [
          ...versions.slice(0, this.maxVersions - 10), // Recent versions
          ...versions.filter(v => v.version_type === 'submission'), // All submissions
          ...versions.filter(v => v.version_type === 'checkpoint') // All checkpoints
        ];
        
        // Remove duplicates
        const keepIds = new Set(versionsToKeep.map(v => v.id));
        const versionsToDelete = versions.filter(v => !keepIds.has(v.id));
        
        // Mock delete old auto-save versions
        console.log('Would delete old version:', version.id);
      }
    } catch (error) {
      console.error('Failed to cleanup old versions:', error);
    }
  }

  /**
   * Export version history as JSON
   */
  async exportVersionHistory(classroomId, userEmail) {
    try {
      const versions = await this.getVersionHistory(classroomId, userEmail);
      
      return {
        classroomId,
        userEmail,
        exportDate: new Date().toISOString(),
        totalVersions: versions.length,
        versions: versions.map(v => ({
          id: v.id,
          timestamp: v.timestamp,
          type: v.version_type,
          description: v.description,
          language: v.language,
          codeLength: v.code_content.length,
          lineCount: v.code_content.split('\n').length
        }))
      };
    } catch (error) {
      console.error('Failed to export version history:', error);
      return null;
    }
  }

  /**
   * Import a previous code version
   */
  async importCode(classroomId, userEmail, importData) {
    try {
      // Validate import data
      if (!importData.code || !importData.language) {
        throw new Error('Invalid import data');
      }

      // Create backup before import
      const currentCode = await this.getCurrentCode(classroomId, userEmail);
      if (currentCode) {
        await this.saveVersion(
          classroomId, 
          userEmail, 
          currentCode.code, 
          currentCode.language, 
          'checkpoint', 
          'Pre-import backup'
        );
      }

      // Save imported code as new version
      await this.saveVersion(
        classroomId, 
        userEmail, 
        importData.code, 
        importData.language, 
        'manual', 
        `Imported code: ${importData.description || 'External import'}`
      );

      return { success: true, code: importData.code, language: importData.language };
    } catch (error) {
      console.error('Failed to import code:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
const versionControl = new CodeVersionControl();
export default versionControl;