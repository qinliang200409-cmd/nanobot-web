import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Message } from '../types/chat';

export interface Session {
  id: string;
  name: string;
  agentId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
}

// Multi-agent settings
interface MultiAgentSettings {
  enabled: boolean;
  selectedAgents: string[];
}

// Default agents in case API is not available
const DEFAULT_AGENTS: Agent[] = [
  { id: 'default', name: 'Default', description: 'General purpose assistant' },
  { id: 'coder', name: 'Coder', description: 'Expert programmer' },
  { id: 'writer', name: 'Writer', description: 'Creative writer' },
];

// Default multi-agent settings
const DEFAULT_MULTI_AGENT_SETTINGS: MultiAgentSettings = {
  enabled: false,
  selectedAgents: ['coder', 'writer'],
};

const STORAGE_KEY = 'nanobot-sessions';
const ACTIVE_SESSION_KEY = 'nanobot-active-session-id';

// Backend API helpers
async function clearBackendSession(sessionId: string) {
  try {
    await fetch('/api/chat/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  } catch (error) {
    console.warn('Failed to clear backend session:', error);
  }
}

function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createEmptySession(agentId: string = 'default'): Session {
  const now = new Date();
  return {
    id: generateId(),
    name: 'New conversation',
    agentId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function loadSessions(): Session[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((session: Session) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages?.map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })) || [],
      }));
    }
  } catch (error) {
    console.error('Failed to load sessions:', error);
  }
  return [];
}

function saveSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save sessions:', error);
  }
}

interface SessionContextValue {
  sessions: Session[];
  activeSession: Session | null;
  availableAgents: Agent[];
  multiAgentSettings: MultiAgentSettings;
  createSession: (agentId?: string) => Session;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  updateSessionName: (sessionId: string, name: string) => void;
  updateSessionAgent: (sessionId: string, agentId: string) => void;
  addMessageToSession: (sessionId: string, message: Message) => void;
  setSessionMessages: (sessionId: string, messages: Message[]) => void;
  clearSessionMessages: (sessionId: string) => void;
  setMultiAgentEnabled: (enabled: boolean) => void;
  setMultiAgentSelected: (agentIds: string[]) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [multiAgentSettings, setMultiAgentSettings] = useState<MultiAgentSettings>(DEFAULT_MULTI_AGENT_SETTINGS);

  // Load multi-agent settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('nanobot-multi-agent');
    if (saved) {
      try {
        setMultiAgentSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse multi-agent settings:', e);
      }
    }
  }, []);

  // Save multi-agent settings when changed
  useEffect(() => {
    localStorage.setItem('nanobot-multi-agent', JSON.stringify(multiAgentSettings));
  }, [multiAgentSettings]);

  // Fetch agents from API on mount
  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch('/api/agents');
        if (response.ok) {
          const data = await response.json();
          if (data.agents && data.agents.length > 0) {
            setAvailableAgents(data.agents);
          }
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
        // Fall back to default agents
      }
    }
    fetchAgents();
  }, []);

  // Load sessions on mount
  useEffect(() => {
    const loadedSessions = loadSessions();
    if (loadedSessions.length > 0) {
      setSessions(loadedSessions);
      const storedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY);
      const activeSession = loadedSessions.find(s => s.id === storedActiveId);
      setActiveSessionId(activeSession ? storedActiveId : loadedSessions[0].id);
    } else {
      // Create initial session if none exist
      const initialSession = createEmptySession();
      setSessions([initialSession]);
      setActiveSessionId(initialSession.id);
      saveSessions([initialSession]);
      localStorage.setItem(ACTIVE_SESSION_KEY, initialSession.id);
    }
  }, []);

  // Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
    }
  }, [sessions]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  const createSession = useCallback((agentId: string = 'default') => {
    const newSession = createEmptySession(agentId);
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    localStorage.setItem(ACTIVE_SESSION_KEY, newSession.id);
    
    // Dispatch custom event for Chat page to listen
    window.dispatchEvent(new CustomEvent('session-changed', { detail: { sessionId: newSession.id } }));
    
    return newSession;
  }, []);

  const switchSession = useCallback((sessionId: string) => {
    // Clear previous session from backend cache
    if (activeSessionId) {
      clearBackendSession(activeSessionId);
    }
    
    setActiveSessionId(sessionId);
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    
    // Dispatch custom event for Chat page to listen
    window.dispatchEvent(new CustomEvent('session-changed', { detail: { sessionId } }));
  }, [activeSessionId]);

  const deleteSession = useCallback((sessionId: string) => {
    // Delete session from backend
    clearBackendSession(sessionId);
    
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
      if (filtered.length === 0) {
        // Create new session if all are deleted
        const newSession = createEmptySession();
        setActiveSessionId(newSession.id);
        localStorage.setItem(ACTIVE_SESSION_KEY, newSession.id);
        return [newSession];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered[0].id);
        localStorage.setItem(ACTIVE_SESSION_KEY, filtered[0].id);
      }
      return filtered;
    });
  }, [activeSessionId]);

  const updateSessionName = useCallback((sessionId: string, name: string) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, name, updatedAt: new Date() }
        : s
    ));
  }, []);

  const updateSessionAgent = useCallback((sessionId: string, agentId: string) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, agentId, updatedAt: new Date() }
        : s
    ));
  }, []);

  const addMessageToSession = useCallback((sessionId: string, message: Message) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        // Auto-generate name from first user message
        let name = s.name;
        if (s.messages.length === 0 && message.role === 'user') {
          name = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
        }
        return {
          ...s,
          name,
          messages: [...s.messages, message],
          updatedAt: new Date(),
        };
      }
      return s;
    }));
  }, []);

  const setSessionMessages = useCallback((sessionId: string, messages: Message[]) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, messages, updatedAt: new Date() }
        : s
    ));
  }, []);

  const clearSessionMessages = useCallback((sessionId: string) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, messages: [], updatedAt: new Date() }
        : s
    ));
  }, []);

  const setMultiAgentEnabled = useCallback((enabled: boolean) => {
    setMultiAgentSettings(prev => ({ ...prev, enabled }));
  }, []);

  const setMultiAgentSelected = useCallback((agentIds: string[]) => {
    setMultiAgentSettings(prev => ({ ...prev, selectedAgents: agentIds }));
  }, []);

  return (
    <SessionContext.Provider value={{
      sessions,
      activeSession,
      availableAgents,
      multiAgentSettings,
      createSession,
      switchSession,
      deleteSession,
      updateSessionName,
      updateSessionAgent,
      addMessageToSession,
      setSessionMessages,
      clearSessionMessages,
      setMultiAgentEnabled,
      setMultiAgentSelected,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
