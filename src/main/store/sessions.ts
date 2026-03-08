/**
 * Session Storage Manager
 * Handles persistence of chat sessions to disk
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  attachments?: Array<{
    type: string;
    name: string;
    content?: string;
    path?: string;
  }>;
  metadata?: {
    model?: string;
    tokens?: number;
    finishReason?: string;
    toolId?: string;
    toolName?: string;
    arguments?: unknown;
  };
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  workingDir: string;
  messages: Message[];
  settings?: {
    mode?: string;
    model?: string;
    deepThinking?: boolean;
    deepThinkingLevel?: number;
  };
}

// ============================================================================
// Session Store Class
// ============================================================================

export class SessionStore {
  private sessionsDir: string;
  private sessionsCache: Map<string, Session> = new Map();
  private isCacheValid = false;

  constructor(sessionsDir?: string) {
    // Default to ~/.iflow-paw/sessions
    this.sessionsDir = sessionsDir || path.join(os.homedir(), '.iflow-paw', 'sessions');
    this.ensureDirectoryExists();
  }

  // ========================================================================
  // Directory Management
  // ========================================================================

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  // ========================================================================
  // CRUD Operations
  // ========================================================================

  /**
   * Load all sessions from disk
   */
  loadAllSessions(): Session[] {
    if (this.isCacheValid) {
      return Array.from(this.sessionsCache.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    this.ensureDirectoryExists();
    const sessions: Session[] = [];

    try {
      const files = fs.readdirSync(this.sessionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const session = this.loadSessionFromFile(path.join(this.sessionsDir, file));
            if (session) {
              sessions.push(session);
              this.sessionsCache.set(session.id, session);
            }
          } catch (error) {
            console.error(`[SessionStore] Failed to load session file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[SessionStore] Failed to read sessions directory:', error);
    }

    this.isCacheValid = true;

    // Sort by updatedAt descending (most recent first)
    return sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Load a single session from file
   */
  private loadSessionFromFile(filePath: string): Session | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const session = JSON.parse(content) as Session;
      
      // Validate required fields
      if (!session.id || !session.title) {
        console.warn(`[SessionStore] Invalid session file: ${filePath}`);
        return null;
      }

      return session;
    } catch (error) {
      console.error(`[SessionStore] Failed to parse session file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Load a specific session by ID
   */
  loadSession(sessionId: string): Session | null {
    // Check cache first
    if (this.sessionsCache.has(sessionId)) {
      return this.sessionsCache.get(sessionId)!;
    }

    const filePath = this.getSessionFilePath(sessionId);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const session = this.loadSessionFromFile(filePath);
    if (session) {
      this.sessionsCache.set(sessionId, session);
    }
    return session;
  }

  /**
   * Save a session to disk
   */
  saveSession(session: Session): void {
    this.ensureDirectoryExists();
    
    // Update timestamp
    session.updatedAt = new Date().toISOString();

    const filePath = this.getSessionFilePath(session.id);
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
      this.sessionsCache.set(session.id, session);
    } catch (error) {
      console.error(`[SessionStore] Failed to save session ${session.id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const filePath = this.getSessionFilePath(sessionId);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      this.sessionsCache.delete(sessionId);
      return true;
    } catch (error) {
      console.error(`[SessionStore] Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Create a new session
   */
  createSession(title: string, workingDir: string, settings?: Session['settings']): Session {
    const now = new Date().toISOString();
    const session: Session = {
      id: uuidv4(),
      title: title || 'New Chat',
      createdAt: now,
      updatedAt: now,
      workingDir: workingDir || process.cwd(),
      messages: [],
      settings: settings || {
        mode: 'Smart',
        model: 'GLM-4.7',
        deepThinking: false,
        deepThinkingLevel: 1,
      },
    };

    this.saveSession(session);
    return session;
  }

  /**
   * Update session title
   */
  updateSessionTitle(sessionId: string, title: string): Session | null {
    const session = this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    session.title = title;
    this.saveSession(session);
    return session;
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, message: Omit<Message, 'id' | 'timestamp'> & { id?: string }): Session | null {
    const session = this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    const newMessage: Message = {
      ...message,
      id: message.id || uuidv4(), // 使用传入的 ID 或生成新的
      timestamp: new Date().toISOString(),
    };

    session.messages.push(newMessage);
    this.saveSession(session);
    return session;
  }

  /**
   * Update a message in a session
   */
  updateMessage(
    sessionId: string,
    messageId: string,
    updates: Partial<Omit<Message, 'id'>>
  ): Session | null {
    const session = this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    const messageIndex = session.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      return null;
    }

    session.messages[messageIndex] = {
      ...session.messages[messageIndex],
      ...updates,
    };

    this.saveSession(session);
    return session;
  }

  /**
   * Append content to a streaming message
   */
  appendMessageContent(
    sessionId: string,
    messageId: string,
    content: string,
    isComplete = false
  ): Session | null {
    const session = this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    const messageIndex = session.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      return null;
    }

    const message = session.messages[messageIndex];
    message.content += content;
    message.isStreaming = !isComplete;

    this.saveSession(session);
    return session;
  }

  /**
   * Clear all sessions (use with caution)
   */
  clearAllSessions(): void {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.sessionsDir, file));
        }
      }
      this.sessionsCache.clear();
      this.isCacheValid = false;
    } catch (error) {
      console.error('[SessionStore] Failed to clear sessions:', error);
      throw error;
    }
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.loadAllSessions().length;
  }

  /**
   * Invalidate cache (force reload on next access)
   */
  invalidateCache(): void {
    this.isCacheValid = false;
    this.sessionsCache.clear();
  }

  /**
   * Get storage directory path
   */
  getStoragePath(): string {
    return this.sessionsDir;
  }
}

// Export singleton instance
export const sessionStore = new SessionStore();
