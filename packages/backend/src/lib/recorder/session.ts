import { HttpProxyRecorder } from './http-proxy.js';
import { PlaywrightRecorder } from './playwright.js';
import type { RecorderSession, RecorderMode, RecorderOptions } from './types.js';

type AnyRecorder = HttpProxyRecorder | PlaywrightRecorder;

class RecorderSessionManager {
  /** Singleton instances per mode */
  private recorders = new Map<RecorderMode, AnyRecorder>();

  /** Active session by project ID */
  private projectSessions = new Map<string, RecorderSession>();

  getOrCreateRecorder(mode: RecorderMode): AnyRecorder {
    let recorder = this.recorders.get(mode);
    if (!recorder) {
      recorder = mode === 'http-proxy' ? new HttpProxyRecorder() : new PlaywrightRecorder();
      this.recorders.set(mode, recorder);
    }
    return recorder;
  }

  getRecorder(mode: RecorderMode): AnyRecorder | undefined {
    return this.recorders.get(mode);
  }

  getActiveRecorder(): AnyRecorder | undefined {
    for (const recorder of this.recorders.values()) {
      if (recorder.isRecording()) return recorder;
    }
    return undefined;
  }

  async startSession(projectId: string, options: RecorderOptions): Promise<RecorderSession> {
    // Stop any existing session for this project
    const existing = this.projectSessions.get(projectId);
    if (existing?.status === 'recording') {
      const recorder = this.recorders.get(existing.mode);
      if (recorder) await recorder.stop();
    }

    const recorder = this.getOrCreateRecorder(options.mode);
    const session = await recorder.start(options);
    this.projectSessions.set(projectId, session);
    return session;
  }

  async stopSession(projectId: string): Promise<RecorderSession | null> {
    const session = this.projectSessions.get(projectId);
    if (!session) return null;

    const recorder = this.recorders.get(session.mode);
    if (recorder) {
      const stopped = await recorder.stop();
      this.projectSessions.set(projectId, stopped);
      return stopped;
    }
    return null;
  }

  getSession(projectId: string): RecorderSession | undefined {
    return this.projectSessions.get(projectId);
  }

  getRecorderForProject(projectId: string): AnyRecorder | undefined {
    const session = this.projectSessions.get(projectId);
    if (!session) return undefined;
    return this.recorders.get(session.mode);
  }

  clearCaptured(projectId: string): void {
    const recorder = this.getRecorderForProject(projectId);
    if (recorder) recorder.clear();
  }
}

export const recorderManager = new RecorderSessionManager();
