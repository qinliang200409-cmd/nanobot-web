import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { useSession } from '../contexts/SessionContext';
import type { Message, ToolCall, ProgressStep } from '../types/chat';

// Session Tabs - REMOVED: duplicates sidebar functionality

// Tool Details Panel - slide-out panel
const ToolDetailsPanel = memo(function ToolDetailsPanel({ 
  isOpen, 
  onClose, 
  progressSteps,
  toolCalls 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  progressSteps: ProgressStep[];
  toolCalls: ToolCall[];
}) {
  interface ToolItem {
    id: string;
    name: string;
    status?: string;
    content?: string;
    action?: string | null;
    arguments?: Record<string, unknown>;
    result?: string | undefined;
    isProgress: boolean;
  }
  
  const allTools: ToolItem[] = [
    ...progressSteps.map((step, i) => ({
      id: `progress-${i}`,
      name: step.tool || 'Unknown',
      action: step.action,
      status: step.status,
      content: step.content,
      isProgress: true
    })),
    ...(toolCalls || []).map((tc, i) => ({
      id: tc.id || `call-${i}`,
      name: tc.name,
      arguments: tc.arguments,
      result: tc.result,
      isProgress: false
    }))
  ];

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 bottom-0 w-[400px] max-w-[90vw] bg-white dark:bg-[#1A1A1A] border-l border-[#E5E5E5] dark:border-[#333333] z-50 flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5] dark:border-[#333333]">
          <h3 className="font-semibold text-[#1A1A1A] dark:text-white">Tool Execution History</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#F5F5F5] dark:hover:bg-[#333333]">
            <svg className="w-5 h-5 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {allTools.length === 0 ? (
            <p className="text-center text-[#999999] text-sm py-8">No tool executions yet</p>
          ) : (
            allTools.map((tool) => (
              <div key={tool.id} className="border rounded-lg overflow-hidden border-[#E5E5E5] dark:border-[#444444]">
                <div className="px-3 py-2 flex items-center gap-2 bg-[#F5F5F5] dark:bg-[#333333]">
                  {tool.status === 'completed' && <span className="text-green-600">✓</span>}
                  {tool.status === 'error' && <span className="text-red-600">✗</span>}
                  <span className="font-medium text-sm text-[#1A1A1A] dark:text-white">{tool.name}</span>
                </div>
                <div className="p-3 bg-white dark:bg-[#242424] text-xs">
                  {tool.isProgress ? (
                    tool.content && <p className="text-[#666666]">{tool.content}</p>
                  ) : (
                    <>
                      <pre className="mt-1 p-2 bg-[#F5F5F5] dark:bg-[#333333] rounded overflow-x-auto text-[#1A1A1A] dark:text-white">
                        {JSON.stringify(tool.arguments, null, 2)}
                      </pre>
                      {tool.result && (
                        <pre className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded overflow-x-auto text-[#1A1A1A] dark:text-white max-h-40">
                          {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </>
  );
});

// Copy Button
const CopyButton = memo(function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-[#E5E5E5] dark:hover:bg-[#444444] text-[#999999]" title={copied ? 'Copied!' : 'Copy'}>
      {copied ? (
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
});

const DEFAULT_MESSAGES: Message[] = [
  { id: 'welcome', role: 'assistant', content: "Hello! I'm your AI assistant powered by nanobot. How can I help you today?", timestamp: new Date() }
];

// Multi-Agent Card Component
const MultiAgentCard = memo(function MultiAgentCard({ 
  agentId, 
  response 
}: { 
  agentId: string; 
  response: { content: string; status: 'pending' | 'streaming' | 'completed' | 'error' };
}) {
  const agentIcons: Record<string, string> = {
    router: '',
    coder: '',
    writer: '',
    default: '',
    creator: '',
    meimei: '',
    browser: '',
  };
  
  const icon = agentIcons[agentId] || '🤖';
  const isPending = response.status === 'pending';
  const isStreaming = response.status === 'streaming';
  const isCompleted = response.status === 'completed';
  const isError = response.status === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex justify-start"
    >
      <div className="max-w-[70%] flex flex-col items-start">
        <div className="flex items-center gap-2 mb-1">
          {icon && <span className="text-2xl">{icon}</span>}
          <span className="font-medium text-sm text-[#1A1A1A] dark:text-white capitalize">{agentId}</span>
          {isPending && <span className="text-xs text-[#888888]">Pending...</span>}
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-blue-600">
              <span className="animate-pulse">●</span> Generating...
            </span>
          )}
          {isCompleted && <span className="text-xs text-green-600">✓ Done</span>}
          {isError && <span className="text-xs text-red-600">✗ Error</span>}
        </div>
        <div className="px-4 py-3 bg-white dark:bg-[#333333] border border-[#E5E5E5] dark:border-[#444444] rounded-2xl rounded-bl-md shadow-sm max-h-[200px] overflow-y-auto">
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-[#1A1A1A] dark:text-white">
            {response.content || (isPending ? 'Waiting...' : isStreaming ? 'Generating response...' : '')}
          </p>
        </div>
      </div>
    </motion.div>
  );
});

const ProgressStepItem = memo(function ProgressStepItem({ step }: { step: ProgressStep }) {
  const isRunning = step.status === 'running';
  const isError = step.status === 'error';
  const isCompleted = step.status === 'completed';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
        isError ? 'bg-red-50 border-red-200' : isCompleted ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
      }`}
    >
      {isRunning && (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
      )}
      {isCompleted && <span className="text-green-600 text-lg">OK</span>}
      {isError && <span className="text-red-600 text-lg">X</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {step.tool && <span className="text-sm font-medium text-gray-900">{step.tool}</span>}
          {step.action && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${isRunning ? 'bg-blue-100 text-blue-700' : isCompleted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {step.action}
            </span>
          )}
        </div>
        {step.file && <div className="text-xs text-gray-500 truncate mt-0.5">{step.file}</div>}
      </div>
    </motion.div>
  );
});

const ToolCallItem = memo(function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-2 border border-[#E5E5E5] dark:border-[#444444] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-[#333333] hover:bg-[#EEEEEE] dark:hover:bg-[#444444] flex items-center justify-between text-left"
      >
        <span className="text-sm font-mono text-[#1A1A1A] dark:text-white">
          <span className="font-semibold">{toolCall.name}</span>
          <span className="text-[#666666] dark:text-[#999999]">(...)</span>
        </span>
        <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} className="text-[#666666] dark:text-[#999999]">▼</motion.span>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 py-2 bg-white dark:bg-[#2a2a2a] border-t border-[#E5E5E5] dark:border-[#444444]">
              <div className="text-xs font-mono text-[#666666] dark:text-[#999999] mb-2">Arguments:</div>
              <pre className="text-xs font-mono bg-[#F9F9F9] dark:bg-[#333333] p-2 rounded overflow-x-auto text-[#1A1A1A] dark:text-white">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
              {toolCall.result && (
                <>
                  <div className="text-xs font-mono text-[#666666] dark:text-[#999999] mt-2 mb-1">Result:</div>
                  <pre className="text-xs font-mono bg-[#F0F8FF] dark:bg-[#1a2a3a] p-2 rounded overflow-x-auto">{toolCall.result}</pre>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const TypingIndicator = memo(function TypingIndicator({ isThinking }: { isThinking?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center gap-1 px-4 py-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div key={i} className="w-2 h-2 bg-[#666666] dark:bg-[#999999] rounded-full" animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </div>
      <span className="text-xs text-[#999999] ml-2">{isThinking ? 'AI is thinking...' : 'AI is responding...'}</span>
    </motion.div>
  );
});

const StreamingContent = memo(function StreamingContent({ content }: { content: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="flex justify-start">
      <div className="max-w-[70%] flex flex-col items-start">
        <span className="text-xs text-[#888888] dark:text-[#999999] mb-1">AI {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <div className="px-4 py-3 rounded-2xl bg-white dark:bg-[#333333] border border-[#E5E5E5] dark:border-[#444444] rounded-bl-md shadow-sm">
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-[#1A1A1A] dark:text-white">
            {content}
            <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} className="inline-block w-2 h-4 bg-[#1A1A1A] dark:bg-white ml-0.5 align-middle" />
          </p>
        </div>
        <span className="text-xs text-[#888888] dark:text-[#999999] mt-1">Streaming...</span>
      </div>
    </motion.div>
  );
});

const MessageItem = memo(function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className={`text-xs text-[#888888] dark:text-[#999999] ${isUser ? 'text-right' : 'text-left'}`}>
            {isUser ? 'You' : (message.agentId || 'AI')} {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && <CopyButton text={message.content} />}
        </div>
        <div className={`px-4 py-3 rounded-2xl ${isUser ? 'bg-[#1A1A1A] dark:bg-white text-white dark:text-[#1A1A1A] rounded-br-md' : 'bg-white dark:bg-[#333333] border border-[#E5E5E5] dark:border-[#444444] rounded-bl-md shadow-sm'}`}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
        <AnimatePresence>
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 w-full">
              <div className="text-xs text-[#888888] mb-1">Tool Calls ({message.toolCalls.length})</div>
              {message.toolCalls.map((toolCall) => <ToolCallItem key={toolCall.id} toolCall={toolCall} />)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

export function Chat() {
  const { activeSession, addMessageToSession, clearSessionMessages, updateSessionName, multiAgentSettings, setMultiAgentEnabled } = useSession();
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [isToolPanelOpen, setIsToolPanelOpen] = useState(false);
  
  // Multi-agent state
  const [multiAgentResponses, setMultiAgentResponses] = useState<Record<string, { content: string; status: 'pending' | 'streaming' | 'completed' | 'error' }>>({});
  const multiAgentStreamingRef = useRef<Record<string, string>>({});
  
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef('');
  const userScrolledRef = useRef(false);

  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      userScrolledRef.current = !isAtBottom;
    }
  }, []);

  useEffect(() => {
    if (activeSession) {
      const sessionMessages = activeSession.messages.length > 0 ? activeSession.messages : DEFAULT_MESSAGES;
      setMessages(sessionMessages);
      userScrolledRef.current = false;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 0);
    } else {
      setMessages(DEFAULT_MESSAGES);
    }
  }, [activeSession?.id]);

  useEffect(() => {
    const handleSessionChange = (event: CustomEvent) => {
      console.log('Session changed to:', event.detail.sessionId);
    };
    window.addEventListener('session-changed', handleSessionChange as EventListener);
    return () => window.removeEventListener('session-changed', handleSessionChange as EventListener);
  }, []);

  useEffect(() => {
    if (!userScrolledRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isStreaming]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputValue]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || !activeSession) return;

    // 智能多Agent模式：前端驱动编排
    if (multiAgentSettings.enabled) {
      await handleSmartChat(content);
      return;
    }

    const userMessage: Message = { id: `msg-${Date.now()}`, role: 'user', content: content.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    addMessageToSession(activeSession.id, userMessage);

    setStreamingContent('');
    setIsStreaming(false);
    setIsThinking(false);
    streamingContentRef.current = '';
    setIsLoading(true);

    try {
      // Build request body
      const requestBody: Record<string, unknown> = {
        message: content.trim(),
        sessionId: activeSession.id,
        agentId: activeSession.agentId,
      };

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      if (res.body) {
        setIsStreaming(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEventType = 'message';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || line.startsWith(':')) continue;
            if (line.startsWith('event:')) { currentEventType = line.slice(6).trim(); continue; }
            if (line.startsWith('data:')) {
              const dataContent = line.slice(5).trim();
              try {
                const data = JSON.parse(dataContent);
                switch (currentEventType) {
                  case 'thinking':
                    setIsThinking(data.status === 'starting' || data.status === 'queued');
                    break;
                  case 'progress':
                    if (data.tool || data.file || data.action) {
                      setProgressSteps(prev => {
                        const newStep: ProgressStep = { tool: data.tool, file: data.file, action: data.action, status: data.status || 'running', content: data.content };
                        const existingIndex = prev.findIndex(s => s.tool === data.tool && s.file === data.file);
                        if (existingIndex >= 0) { const updated = [...prev]; updated[existingIndex] = newStep; return updated; }
                        return [...prev, newStep];
                      });
                    }
                    streamingContentRef.current += data.content;
                    setStreamingContent(streamingContentRef.current);
                    break;
                  // Multi-agent events
                  case 'agent_start':
                    if (data.agentId) {
                      setMultiAgentResponses(prev => ({
                        ...prev,
                        [data.agentId]: { content: '', status: 'streaming' }
                      }));
                      multiAgentStreamingRef.current[data.agentId] = '';
                    }
                    break;
                  case 'agent_progress':
                    if (data.agentId && data.content) {
                      multiAgentStreamingRef.current[data.agentId] = (multiAgentStreamingRef.current[data.agentId] || '') + data.content;
                      setMultiAgentResponses(prev => ({
                        ...prev,
                        [data.agentId]: { 
                          content: multiAgentStreamingRef.current[data.agentId], 
                          status: 'streaming' 
                        }
                      }));
                    }
                    break;
                  case 'agent_done':
                    if (data.agentId) {
                      multiAgentStreamingRef.current[data.agentId] = data.content || multiAgentStreamingRef.current[data.agentId] || '';
                      setMultiAgentResponses(prev => ({
                        ...prev,
                        [data.agentId]: { 
                          content: multiAgentStreamingRef.current[data.agentId], 
                          status: data.error ? 'error' : 'completed' 
                        }
                      }));
                    }
                    break;
                  case 'all_done':
                    setIsStreaming(false);
                    setIsThinking(false);
                    const allIds = Object.keys(multiAgentStreamingRef.current);
                    const combined = allIds.map(id => `## ${id}\n\n${multiAgentStreamingRef.current[id] || ''}`).join('\n\n---\n\n');
                    const assistantMessage: Message = { id: `msg-${Date.now()}`, role: 'assistant', content: combined || 'No response', timestamp: new Date() };
                    setMessages(prev => [...prev, assistantMessage]);
                    addMessageToSession(activeSession.id, assistantMessage);
                    if (activeSession.messages.length === 0) updateSessionName(activeSession.id, content.slice(0, 30) + (content.length > 30 ? '...' : ''));
                    setMultiAgentResponses({});
                    multiAgentStreamingRef.current = {};
                    setShowSummary(true);
                    setTimeout(() => setShowSummary(false), 3000);
                    return;
                  case 'error': console.error('Stream error:', data.content); break;
                }
              } catch { streamingContentRef.current += dataContent; setStreamingContent(streamingContentRef.current); }
              currentEventType = 'message';
            }
          }
        }
      }

      setIsStreaming(false);
      setIsThinking(false);
      const assistantMessage: Message = { id: `msg-${Date.now()}`, role: 'assistant', content: streamingContentRef.current || 'No response', timestamp: new Date() };
      setMessages(prev => [...prev, assistantMessage]);
      addMessageToSession(activeSession.id, assistantMessage);
      if (activeSession.messages.length === 0) updateSessionName(activeSession.id, content.slice(0, 30) + (content.length > 30 ? '...' : ''));
      setStreamingContent('');
      setShowSummary(true);
      setTimeout(() => setShowSummary(false), 3000);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: Message = { id: `msg-${Date.now()}`, role: 'assistant', content: 'Sorry, I encountered an error.', timestamp: new Date() };
      setMessages(prev => [...prev, errorMsg]);
      addMessageToSession(activeSession.id, errorMsg);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setIsThinking(false);
      setProgressSteps([]);
      setStreamingContent('');
    }
  }, [isLoading, activeSession, addMessageToSession, updateSessionName]);

  // 路由计划类型
  interface RoutePlan {
    execution_mode?: string;
    reasoning?: string;
    agents: string[];
    task_for_each: Record<string, string>;
  }

  // 前端驱动智能聊天 - 路由 + 并行执行
  const handleSmartChat = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || !activeSession) return;

    const userMessage: Message = { id: `msg-${Date.now()}`, role: 'user', content: content.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    addMessageToSession(activeSession.id, userMessage);

    setIsLoading(true);
    setIsStreaming(true);
    setMultiAgentResponses({});
    multiAgentStreamingRef.current = {};

    // 显示 Router 正在分析任务
    const routingMessage: Message = { 
      id: `msg-routing-${Date.now()}`, 
      role: 'assistant', 
      content: '🤔 正在分析任务并调度 Agent...', 
      timestamp: new Date(),
      agentId: 'router'
    };
    setMessages(prev => [...prev, routingMessage]);

    try {
      // 第一步：获取路由计划
      const routeRes = await fetch('/api/chat/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          sessionId: activeSession.id,
          agentId: activeSession.agentId,
        })
      });

      if (!routeRes.ok) throw new Error(`Route API error: ${routeRes.status}`);

      const routeData = await routeRes.json();
      
      if (!routeData.success || !routeData.plan) {
        throw new Error(routeData.error || 'Routing failed');
      }

      const plan: RoutePlan = routeData.plan;
      const agents = plan.agents || [];
      const taskMap = plan.task_for_each || {};
      const reasoning = plan.reasoning || '';

      if (agents.length === 0) {
        throw new Error('No agents returned from router');
      }

      // 更新 routingMessage 显示调度结果
      const routingSummary = `✅ 已调度 ${agents.length} 个 Agent:\n${agents.map(a => `• ${a}`).join('\n')}\n\n${reasoning ? `分析: ${reasoning}` : ''}`;
      setMessages(prev => prev.map(m => 
        m.id.startsWith('msg-routing-') 
          ? { ...m, content: routingSummary } 
          : m
      ));

      // 初始化所有 agent 状态
      const initialResponses: Record<string, { content: string; status: 'pending' | 'streaming' | 'completed' | 'error' }> = {};
      agents.forEach(agentId => {
        initialResponses[agentId] = { content: '', status: 'pending' };
        multiAgentStreamingRef.current[agentId] = '';
      });
      setMultiAgentResponses(initialResponses);

      // 第二步：并行执行所有任务
      const taskPromises = agents.map(async (agentId) => {
        const taskMessage = taskMap[agentId] || content.trim();

        // 更新状态为 streaming
        setMultiAgentResponses(prev => ({
          ...prev,
          [agentId]: { content: '', status: 'streaming' }
        }));

        const taskRes = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: taskMessage,
            sessionId: activeSession.id,
            agentId: activeSession.agentId,
            agentIds: [agentId], // 只指定一个 agent
          })
        });

        if (!taskRes.ok) throw new Error(`Task API error: ${taskRes.status}`);

        // 读取流式响应
        if (taskRes.body) {
          const reader = taskRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEventType = 'message';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              if (line.startsWith('event:')) {
                currentEventType = line.slice(6).trim();
                continue;
              }
              if (line.startsWith('data:')) {
                const dataContent = line.slice(5).trim();
                try {
                  const data = JSON.parse(dataContent);

                  // 根据事件类型处理
                  switch (currentEventType) {
                    case 'thinking':
                      setIsThinking(data.status === 'starting' || data.status === 'queued');
                      break;
                    case 'progress':
                      if (data.tool || data.file || data.action) {
                        setProgressSteps(prev => {
                          const newStep: ProgressStep = { tool: data.tool, file: data.file, action: data.action, status: data.status || 'running', content: data.content };
                          const existingIndex = prev.findIndex(s => s.tool === data.tool && s.file === data.file);
                          if (existingIndex >= 0) { const updated = [...prev]; updated[existingIndex] = newStep; return updated; }
                          return [...prev, newStep];
                        });
                      }
                      // 累加到当前 agent 的内容
                      const progressContent = data.content || '';
                      if (progressContent) {
                        multiAgentStreamingRef.current[agentId] += progressContent;
                        setMultiAgentResponses(prev => ({
                          ...prev,
                          [agentId]: {
                            content: multiAgentStreamingRef.current[agentId],
                            status: 'streaming'
                          }
                        }));
                      }
                      break;
                    case 'message':
                    case 'content':
                      const msgContent = data.content || data.delta || '';
                      if (msgContent) {
                        multiAgentStreamingRef.current[agentId] += msgContent;
                        setMultiAgentResponses(prev => ({
                          ...prev,
                          [agentId]: {
                            content: multiAgentStreamingRef.current[agentId],
                            status: 'streaming'
                          }
                        }));
                      }
                      break;
                    case 'done':
                    case 'agent_done':
                      setMultiAgentResponses(prev => ({
                        ...prev,
                        [agentId]: {
                          content: multiAgentStreamingRef.current[agentId] || '',
                          status: 'completed'
                        }
                      }));
                      break;
                    case 'error':
                      setMultiAgentResponses(prev => ({
                        ...prev,
                        [agentId]: {
                          content: multiAgentStreamingRef.current[agentId] || `Error: ${data.content || 'Unknown error'}`,
                          status: 'error'
                        }
                      }));
                      break;
                  }
                } catch {
                  // 非 JSON 格式的直接内容
                  if (dataContent) {
                    multiAgentStreamingRef.current[agentId] += dataContent;
                    setMultiAgentResponses(prev => ({
                      ...prev,
                      [agentId]: {
                        content: multiAgentStreamingRef.current[agentId],
                        status: 'streaming'
                      }
                    }));
                  }
                }
                currentEventType = 'message';
              }
            }
          }
        }

        return agentId;
      });

      // 等待所有任务完成
      await Promise.all(taskPromises);

      // 第三步：汇总结果 - 添加多条独立消息
      setIsStreaming(false);
      setIsThinking(false);

      // 为每个 agent 添加独立的消息
      const allAgentIds = Object.keys(multiAgentStreamingRef.current);
      const newMessages: Message[] = allAgentIds.map((agentId, index) => ({
        id: `msg-${Date.now()}-${index}`,
        role: 'assistant' as const,
        content: multiAgentStreamingRef.current[agentId] || '',
        timestamp: new Date(),
        agentId: agentId, // 标记这是哪个 agent 的输出
      }));

      setMessages(prev => [...prev, ...newMessages]);
      newMessages.forEach(msg => addMessageToSession(activeSession.id, msg));
      
      if (activeSession.messages.length === 0) updateSessionName(activeSession.id, content.slice(0, 30) + (content.length > 30 ? '...' : ''));

      setMultiAgentResponses({});
      multiAgentStreamingRef.current = {};
      setShowSummary(true);
      setTimeout(() => setShowSummary(false), 3000);

    } catch (error) {
      console.error('Smart chat error:', error);
      const errorMsg: Message = { id: `msg-${Date.now()}`, role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, timestamp: new Date() };
      setMessages(prev => [...prev, errorMsg]);
      addMessageToSession(activeSession.id, errorMsg);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setIsThinking(false);
      setProgressSteps([]);
    }
  }, [isLoading, activeSession, addMessageToSession, updateSessionName]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleClearHistory = async () => {
    if (activeSession) {
      // Clear from backend
      try {
        await fetch('/api/chat/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: activeSession.id }),
        });
      } catch (error) {
        console.warn('Failed to clear backend session:', error);
      }
      // Clear from frontend
      clearSessionMessages(activeSession.id);
    }
    setMessages(DEFAULT_MESSAGES);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#FAFAFA] dark:bg-[#1A1A1A] overflow-hidden">
      <div className="shrink-0 px-4 py-2 border-b border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#242424] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {showSummary && (
              <motion.div initial={{ opacity: 0, y: -10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.9 }} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs text-green-700">
                <span className="text-green-600">OK</span>
                <span>Saved to memory</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsToolPanelOpen(true)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${progressSteps.length > 0 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 hover:bg-blue-200' : 'text-[#666666] dark:text-[#999999] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-[#F5F5F5] dark:hover:bg-[#333333]'}`} title="View tool execution details">
            Tools {progressSteps.length > 0 && `(${progressSteps.length})`}
          </button>
          {/* Multi-Agent Mode Toggle */}
          <button 
            onClick={() => setMultiAgentEnabled(!multiAgentSettings.enabled)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${multiAgentSettings.enabled ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700' : 'text-[#666666] dark:text-[#999999] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-[#F5F5F5] dark:hover:bg-[#333333]'}`}
            title="Toggle multi-agent mode"
          >
            Multi-Agent {multiAgentSettings.enabled ? 'ON' : 'OFF'}
          </button>
          <button onClick={handleClearHistory} className="text-xs text-[#666666] dark:text-[#999999] hover:text-[#1A1A1A] dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#333333]" title="Clear chat history">Clear Chat</button>
        </div>
      </div>

      <ToolDetailsPanel isOpen={isToolPanelOpen} onClose={() => setIsToolPanelOpen(false)} progressSteps={progressSteps} toolCalls={messages.flatMap(m => m.toolCalls || [])} />

      <AnimatePresence>
        {progressSteps.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-[#E5E5E5] dark:border-[#333333] bg-gray-50 dark:bg-[#242424] px-4 py-2 overflow-hidden">
            <div className="text-xs text-gray-500 dark:text-[#999999] mb-2">Tool Progress</div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {progressSteps.map((step, index) => <ProgressStepItem key={`${step.tool}-${step.file}-${index}`} step={step} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message) => <MessageItem key={message.id} message={message} />)}
        </AnimatePresence>
        <AnimatePresence>
          {isStreaming && streamingContent && <StreamingContent content={streamingContent} />}
        </AnimatePresence>
        
        {/* Multi-Agent Response Cards */}
        <AnimatePresence>
          {Object.keys(multiAgentResponses).length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3"
            >
              {Object.entries(multiAgentResponses).map(([agentId, response]) => (
                <MultiAgentCard key={agentId} agentId={agentId} response={response} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {isThinking && <TypingIndicator isThinking={true} />}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 p-4 border-t border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#242424]">
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="w-full px-4 py-3 text-sm bg-white dark:bg-[#333333] border border-[#E5E5E5] dark:border-[#444444] rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] dark:focus:ring-white focus:border-transparent transition-all duration-200 text-[#1A1A1A] dark:text-white placeholder:text-[#999999]"
              rows={1}
              disabled={isLoading}
              style={{ minHeight: '48px', maxHeight: '150px' }}
            />
          </div>
          <Button onClick={handleSend} disabled={!inputValue.trim() || isLoading} className="px-6 py-3 rounded-2xl font-medium whitespace-nowrap mt-1">Send</Button>
        </div>
        <p className="text-xs text-[#999999] mt-2 text-center">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
}
