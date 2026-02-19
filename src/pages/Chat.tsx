import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { useSession } from '../contexts/SessionContext';
import type { Message, ToolCall, ProgressStep } from '../types/chat';

const DEFAULT_MESSAGES: Message[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: "Hello! I'm your AI assistant powered by nanobot. How can I help you today?",
    timestamp: new Date(),
  },
];

// ProgressStep Component - shows tool execution progress
const ProgressStepItem = memo(function ProgressStepItem({ step }: { step: ProgressStep }) {
  const isRunning = step.status === 'running';
  const isError = step.status === 'error';
  const isCompleted = step.status === 'completed';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
        isError
          ? 'bg-red-50 border-red-200'
          : isCompleted
          ? 'bg-green-50 border-green-200'
          : 'bg-blue-50 border-blue-200'
      }`}
    >
      {/* Status Icon */}
      {isRunning && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
        />
      )}
      {isCompleted && (
        <span className="text-green-600 text-lg">OK</span>
      )}
      {isError && (
        <span className="text-red-600 text-lg">X</span>
      )}

      {/* Tool Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {step.tool && (
            <span className="text-sm font-medium text-gray-900">
              {step.tool}
            </span>
          )}
          {step.action && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              isRunning ? 'bg-blue-100 text-blue-700' :
              isCompleted ? 'bg-green-100 text-green-700' :
              'bg-red-100 text-red-700'
            }`}>
              {step.action}
            </span>
          )}
        </div>
        {step.file && (
          <div className="text-xs text-gray-500 truncate mt-0.5">
            {step.file}
          </div>
        )}
      </div>
    </motion.div>
  );
});

// Tool Call Component - memoized
const ToolCallItem = memo(function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-2 border border-[#E5E5E5] dark:border-[#444444] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-[#333333] hover:bg-[#EEEEEE] dark:hover:bg-[#444444] flex items-center justify-between text-left transition-colors touch-manipulation"
      >
        <span className="text-sm font-mono text-[#1A1A1A] dark:text-white">
          <span className="font-semibold">{toolCall.name}</span>
          <span className="text-[#666666] dark:text-[#999999]">(...)</span>
        </span>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          className="text-[#666666] dark:text-[#999999]"
        >
          ▼
        </motion.span>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 bg-white dark:bg-[#2a2a2a] border-t border-[#E5E5E5] dark:border-[#444444]">
              <div className="text-xs font-mono text-[#666666] dark:text-[#999999] mb-2">
                Arguments:
              </div>
              <pre className="text-xs font-mono bg-[#F9F9F9] dark:bg-[#333333] p-2 rounded overflow-x-auto text-[#1A1A1A] dark:text-white">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
              {toolCall.result && (
                <>
                  <div className="text-xs font-mono text-[#666666] dark:text-[#999999] mt-2 mb-1">
                    Result:
                  </div>
                  <pre className="text-xs font-mono bg-[#F0F8FF] dark:bg-[#1a2a3a] p-2 rounded overflow-x-auto">
                    {toolCall.result}
                  </pre>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Typing Indicator Component - memoized
const TypingIndicator = memo(function TypingIndicator({ isThinking }: { isThinking?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-1 px-4 py-2"
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-[#666666] dark:bg-[#999999] rounded-full"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-[#999999] ml-2">
        {isThinking ? 'AI is thinking...' : 'AI is responding...'}
      </span>
    </motion.div>
  );
});

// Streaming Content Component - displays real-time streaming content
const StreamingContent = memo(function StreamingContent({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="flex justify-start"
    >
      <div className="max-w-[70%] flex flex-col items-start">
        <span className="text-xs text-[#888888] dark:text-[#999999] mb-1">
          AI{' '}
          {new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <div className="px-4 py-3 rounded-2xl bg-white dark:bg-[#333333] border border-[#E5E5E5] dark:border-[#444444] rounded-bl-md shadow-sm">
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-[#1A1A1A] dark:text-white">
            {content}
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
              className="inline-block w-2 h-4 bg-[#1A1A1A] dark:bg-white ml-0.5 align-middle"
            />
          </p>
        </div>
        <span className="text-xs text-[#888888] dark:text-[#999999] mt-1">Streaming...</span>
      </div>
    </motion.div>
  );
});

// Message Component - memoized
const MessageItem = memo(function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[70%] ${
          isUser ? 'items-end' : 'items-start'
        } flex flex-col`}
      >
        {/* Timestamp */}
        <span
          className={`text-xs text-[#888888] dark:text-[#999999] mb-1 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {isUser ? 'You' : 'AI'}{' '}
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {/* Message Content */}
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-[#1A1A1A] dark:bg-white text-white dark:text-[#1A1A1A] rounded-br-md'
              : 'bg-white dark:bg-[#333333] border border-[#E5E5E5] dark:border-[#444444] rounded-bl-md shadow-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        </div>

        {/* Tool Calls */}
        <AnimatePresence>
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 w-full"
            >
              <div className="text-xs text-[#888888] mb-1">
                Tool Calls ({message.toolCalls.length})
              </div>
              {message.toolCalls.map((toolCall) => (
                <ToolCallItem key={toolCall.id} toolCall={toolCall} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

export function Chat() {
  const { activeSession, addMessageToSession, clearSessionMessages, updateSessionName } = useSession();
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef('');
  const userScrolledRef = useRef(false);

  // Handle scroll to detect if user has manually scrolled up
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      // If user scrolls up (not at bottom), mark as user scrolled
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      userScrolledRef.current = !isAtBottom;
    }
  }, []);

  // Load messages when active session changes
  useEffect(() => {
    if (activeSession) {
      const sessionMessages = activeSession.messages.length > 0 
        ? activeSession.messages 
        : DEFAULT_MESSAGES;
      setMessages(sessionMessages);
      
      // Auto-scroll to bottom on session change (reset user scroll state)
      userScrolledRef.current = false;
      
      // Scroll to bottom immediately on session change
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 0);
    } else {
      setMessages(DEFAULT_MESSAGES);
    }
  }, [activeSession?.id]);

  // Listen for session changes from sidebar
  useEffect(() => {
    const handleSessionChange = (event: CustomEvent) => {
      const { sessionId } = event.detail;
      console.log('Session changed to:', sessionId);
    };
    
    window.addEventListener('session-changed', handleSessionChange as EventListener);
    return () => {
      window.removeEventListener('session-changed', handleSessionChange as EventListener);
    };
  }, []);

  // Auto-scroll to bottom when:
  // - Session changes
  // - New user message is sent (not on AI response streaming)
  // - Streaming completes
  useEffect(() => {
    if (!userScrolledRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputValue]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || !activeSession) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    // Add user message to local state and session
    setMessages(prev => [...prev, userMessage]);
    addMessageToSession(activeSession.id, userMessage);

    // Reset streaming states
    setStreamingContent('');
    setIsStreaming(false);
    setIsThinking(false);
    streamingContentRef.current = '';

    // Set loading state
    setIsLoading(true);

    try {
      // Try streaming first
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: content.trim(), 
          sessionId: activeSession.id,
          agentId: activeSession.agentId 
        })
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      // Handle streaming response
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
          
          // Parse SSE events from buffer
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
                
                switch (currentEventType) {
                  case 'thinking':
                    setIsThinking(data.status === 'starting' || data.status === 'queued');
                    break;
                  case 'progress':
                    if (data.tool || data.file || data.action) {
                      setProgressSteps(prev => {
                        const newStep: ProgressStep = {
                          tool: data.tool,
                          file: data.file,
                          action: data.action,
                          status: data.status || 'running',
                          content: data.content
                        };
                        const existingIndex = prev.findIndex(
                          s => s.tool === data.tool && s.file === data.file
                        );
                        if (existingIndex >= 0) {
                          const updated = [...prev];
                          updated[existingIndex] = newStep;
                          return updated;
                        }
                        return [...prev, newStep];
                      });
                    }
                    streamingContentRef.current += data.content;
                    setStreamingContent(streamingContentRef.current);
                    break;
                  case 'error':
                    console.error('Stream error:', data.content);
                    break;
                }
              } catch {
                streamingContentRef.current += dataContent;
                setStreamingContent(streamingContentRef.current);
              }
              currentEventType = 'message';
            }
          }
        }

        setIsStreaming(false);
        setIsThinking(false);

        // Create assistant message
        const assistantMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: streamingContentRef.current || 'No response',
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, assistantMessage]);
        addMessageToSession(activeSession.id, assistantMessage);
        
        // Update session name if this is the first message
        if (activeSession.messages.length === 0) {
          updateSessionName(activeSession.id, userMessage.content.slice(0, 30) + (userMessage.content.length > 30 ? '...' : ''));
        }
        
        setStreamingContent('');
        setShowSummary(true);
        setTimeout(() => setShowSummary(false), 3000);
      }
    } catch (error) {
      console.error('Streaming failed, falling back to regular API:', error);
      
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: content.trim(), 
            sessionId: activeSession.id,
            agentId: activeSession.agentId 
          })
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();

        const assistantMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: data.response || data.message || 'No response',
          timestamp: new Date(),
          toolCalls: data.toolCalls,
        };

        setMessages(prev => [...prev, assistantMessage]);
        addMessageToSession(activeSession.id, assistantMessage);
        
        // Update session name if this is the first message
        if (activeSession.messages.length === 0) {
          updateSessionName(activeSession.id, userMessage.content.slice(0, 30) + (userMessage.content.length > 30 ? '...' : ''));
        }
        
        setShowSummary(true);
        setTimeout(() => setShowSummary(false), 3000);
      } catch (fallbackError) {
        console.error('Failed to send message:', fallbackError);
        const errorMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        addMessageToSession(activeSession.id, errorMessage);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setIsThinking(false);
      setProgressSteps([]);
      setStreamingContent('');
    }
  }, [isLoading, activeSession, addMessageToSession, updateSessionName]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    if (activeSession) {
      clearSessionMessages(activeSession.id);
    }
    setMessages(DEFAULT_MESSAGES);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#FAFAFA] dark:bg-[#1A1A1A] overflow-hidden">
      {/* Header with Clear Button */}
      <div className="shrink-0 px-4 py-2 border-b border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#242424] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {showSummary && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs text-green-700"
              >
                <span className="text-green-600">OK</span>
                <span>Saved to memory</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
          <button
            onClick={handleClearHistory}
            className="text-xs text-[#666666] dark:text-[#999999] hover:text-[#1A1A1A] dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#333333] transition-colors"
            title="Clear chat history"
          >
          Clear Chat
        </button>
      </div>

      {/* Progress Steps - shown when tools are running */}
      <AnimatePresence>
        {progressSteps.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-[#E5E5E5] dark:border-[#333333] bg-gray-50 dark:bg-[#242424] px-4 py-2 overflow-hidden"
          >
            <div className="text-xs text-gray-500 dark:text-[#999999] mb-2">Tool Progress</div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {progressSteps.map((step, index) => (
                <ProgressStepItem key={`${step.tool}-${step.file}-${index}`} step={step} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages List */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-auto p-4 space-y-4"
      >
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
        </AnimatePresence>
        
        {/* Streaming Content - shows in real-time while AI is streaming response */}
        <AnimatePresence>
          {isStreaming && streamingContent && (
            <StreamingContent content={streamingContent} />
          )}
        </AnimatePresence>
        
        {/* Thinking Indicator - shows when AI is thinking (before streaming starts) */}
        <AnimatePresence>
          {isThinking && <TypingIndicator isThinking={true} />}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
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
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="px-6 py-3 rounded-2xl font-medium whitespace-nowrap mt-1"
          >
            Send
          </Button>
        </div>
        <p className="text-xs text-[#999999] mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
