/**
 * Code Version Control System
 * Provides auto-save, version history, rollback capabilities,
 * and submission tracking for educational coding platform.
 */

import { API_BASE_URL } from '@/lib/apiBaseUrl';
import { getAuthToken } from '@/lib/authStorage';

class CodeVersionControl {
  autoSaveInterval = 30000;

  minChangeThreshold = 10;

  autoSaveTimer = null;

  pendingChanges = false;

  getAuthHeaders() {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required for version control.');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  }

  async request(path, options = {}) {
    const mergedHeaders = {
      ...this.getAuthHeaders()
    };

    if (options.headers) {
      Object.assign(mergedHeaders, options.headers);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: mergedHeaders
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Version control request failed.');
    }

    return payload;
  }

  async initializeVersionControl(classroomId, userEmail) {
    try {
      const existingVersions = await this.getVersionHistory(classroomId, userEmail, 1);

      if (existingVersions.length === 0) {
        await this.saveVersion(classroomId, userEmail, '', 'javascript', 'initial', 'Session started');
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize version control:', error);
      return false;
    }
  }

  async saveVersion(classroomId, userEmail, code, language, type = 'auto', description = '') {
    try {
      const payload = await this.request(`/api/classrooms/${encodeURIComponent(classroomId)}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          code,
          language,
          version_type: type,
          description: description || this.generateAutoDescription(type)
        })
      });

      return payload?.version || null;
    } catch (error) {
      console.error('Failed to save version:', error);
      return null;
    }
  }

  async getVersionHistory(classroomId, userEmail, limit = 50) {
    try {
      const payload = await this.request(
        `/api/classrooms/${encodeURIComponent(classroomId)}/versions?limit=${encodeURIComponent(limit)}&user_email=${encodeURIComponent(userEmail)}`,
        { method: 'GET' }
      );

      const versions = Array.isArray(payload?.versions) ? payload.versions : [];

      return versions
        .map((version) => ({
          ...version,
          code_content: String(version.code_content || ''),
          language: String(version.language || 'javascript'),
          version_type: String(version.version_type || 'manual'),
          description: String(version.description || 'Version saved'),
          metadata: typeof version.metadata === 'string' ? version.metadata : JSON.stringify(version.metadata || {}),
          timestamp: version.timestamp || new Date().toISOString()
        }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Failed to get version history:', error);
      return [];
    }
  }

  async restoreVersion(versionId, classroomId, userEmail) {
    try {
      const versions = await this.getVersionHistory(classroomId, userEmail);
      const targetVersion = versions.find((version) => version.id === versionId);

      if (!targetVersion) {
        throw new Error('Version not found');
      }

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

  async compareVersions(versionId1, versionId2, classroomId, userEmail) {
    try {
      const versions = await this.getVersionHistory(classroomId, userEmail);
      const version1 = versions.find((version) => version.id === versionId1);
      const version2 = versions.find((version) => version.id === versionId2);

      if (!version1 || !version2) {
        throw new Error('One or more versions not found');
      }

      const diff = this.generateDiff(version1.code_content, version2.code_content);

      return {
        version1,
        version2,
        diff,
        statistics: {
          linesAdded: diff.filter((entry) => entry.type === 'added').length,
          linesRemoved: diff.filter((entry) => entry.type === 'removed').length,
          linesModified: diff.filter((entry) => entry.type === 'modified').length
        }
      };
    } catch (error) {
      console.error('Failed to compare versions:', error);
      return null;
    }
  }

  startAutoSave(classroomId, userEmail, getCurrentCodeFunc) {
    if (this.autoSaveTimer) {
      this.stopAutoSave();
    }

    this.autoSaveTimer = setInterval(async () => {
      if (!this.pendingChanges) {
        return;
      }

      try {
        const currentCode = await getCurrentCodeFunc();
        if (!currentCode || !String(currentCode.code || '').trim()) {
          return;
        }

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
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, this.autoSaveInterval);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  markPendingChanges() {
    this.pendingChanges = true;
  }

  async createCheckpoint(classroomId, userEmail, code, language, description) {
    return this.saveVersion(classroomId, userEmail, code, language, 'checkpoint', description);
  }

  async saveSubmissionVersion(classroomId, userEmail, code, language, submissionId) {
    return this.saveVersion(
      classroomId,
      userEmail,
      code,
      language,
      'submission',
      `Code submitted (ID: ${submissionId})`
    );
  }

  async getSubmissionHistory(classroomId, userEmail) {
    const versions = await this.getVersionHistory(classroomId, userEmail);
    return versions.filter((version) => version.version_type === 'submission');
  }

  async getLastVersion(classroomId, userEmail) {
    const versions = await this.getVersionHistory(classroomId, userEmail, 1);
    return versions[0] || null;
  }

  async cleanupVersionHistory(classroomId, userEmail, options = {}) {
    const params = new URLSearchParams();

    if (userEmail) {
      params.set('user_email', userEmail);
    }

    if (options.maxTotalHistory) {
      params.set('max_total_history', String(options.maxTotalHistory));
    }

    if (options.maxAutoSnapshots) {
      params.set('max_auto_snapshots', String(options.maxAutoSnapshots));
    }

    if (options.dryRun) {
      params.set('dry_run', 'true');
    }

    const query = params.toString();
    const cleanupPath = `/api/classrooms/${encodeURIComponent(classroomId)}/versions/cleanup`;
    const cleanupUrl = query ? `${cleanupPath}?${query}` : cleanupPath;
    const payload = await this.request(
      cleanupUrl,
      { method: 'DELETE' }
    );

    return payload?.retention || null;
  }

  shouldSaveVersion(currentCode, lastVersionCode) {
    if (!lastVersionCode) return true;

    const sizeDiff = Math.abs(currentCode.length - lastVersionCode.length);
    const significantChange = sizeDiff >= this.minChangeThreshold;
    const structuralChange = this.hasStructuralChanges(currentCode, lastVersionCode);

    return significantChange || structuralChange;
  }

  hasStructuralChanges(code1, code2) {
    const getStructuralTokens = (code) => {
      return code.match(/[{}();=]|if|else|for|while|function|def|class/g) || [];
    };

    const tokens1 = getStructuralTokens(code1);
    const tokens2 = getStructuralTokens(code2);

    return tokens1.length !== tokens2.length || tokens1.join('') !== tokens2.join('');
  }

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

  generateDiff(oldCode, newCode) {
    const oldLines = String(oldCode || '').split('\n');
    const newLines = String(newCode || '').split('\n');
    const diff = [];

    const maxLength = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLength; i += 1) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      if (oldLine === newLine) {
        diff.push({ type: 'unchanged', line: oldLine, lineNumber: i + 1 });
      } else if (!oldLine && newLine) {
        diff.push({ type: 'added', line: newLine, lineNumber: i + 1 });
      } else if (oldLine && !newLine) {
        diff.push({ type: 'removed', line: oldLine, lineNumber: i + 1 });
      } else {
        diff.push({ type: 'modified', oldLine, newLine, lineNumber: i + 1 });
      }
    }

    return diff;
  }

  async exportVersionHistory(classroomId, userEmail) {
    try {
      const versions = await this.getVersionHistory(classroomId, userEmail);

      return {
        classroomId,
        userEmail,
        exportDate: new Date().toISOString(),
        totalVersions: versions.length,
        versions: versions.map((version) => ({
          id: version.id,
          timestamp: version.timestamp,
          type: version.version_type,
          description: version.description,
          language: version.language,
          codeLength: version.code_content.length,
          lineCount: version.code_content.split('\n').length
        }))
      };
    } catch (error) {
      console.error('Failed to export version history:', error);
      return null;
    }
  }

  async importCode(classroomId, userEmail, importData) {
    try {
      if (!importData.code || !importData.language) {
        throw new Error('Invalid import data');
      }

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

const versionControl = new CodeVersionControl();
export default versionControl;
