import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  Copy,
  Check,
  ChevronDown,
  Zap,
  Brain,
  Layers,
  MessageSquare
} from 'lucide-react';
import { FilterOptions, HDBApiResponse } from '../types.ts';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  model?: string;
}

interface GeminiChatbotProps {
  currentFilters?: FilterOptions;
  currentData?: HDBApiResponse | null;
}

const QUICK_PROMPTS = [
  'Which HDB towns currently offer the most affordable resale prices?',
  'Explain the CPF Housing Grants available for resale flats.',
  'What is the Minimum Occupation Period (MOP) rule before selling?',
  'What distinguishes Mature vs Non-Mature HDB estates in Singapore?'
];

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({
  currentFilters,
  currentData
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content:
        "Hello! I'm your **Gemini HDB Advisor**. I can help you analyze Singapore resale flat price trends, navigate CPF housing grants, understand MOP regulations, or compare different towns and flat models.\n\nHow can I help your housing search today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'gemini-3.5-flash'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isLoading]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasOpenedOnce(true);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'model',
        content:
          "Conversation history cleared. Ask me any question about Singapore HDB resale transactions, estate pricing, or housing policies!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: selectedModel
      }
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Build contextual snapshot of the user's current data view
    const contextData = {
      activeTown: currentFilters?.town || 'Islandwide (All Towns)',
      activeFlatType: currentFilters?.flatType || 'All Types',
      searchQuery: currentFilters?.searchQuery || 'None',
      resultsCount: currentData?.count || 0,
      medianPrice: currentData?.median_price ? `$${currentData.median_price.toLocaleString()}` : 'N/A',
      averagePrice: currentData?.average_price ? `$${currentData.average_price.toLocaleString()}` : 'N/A',
      medianPsm: currentData?.median_psm ? `$${currentData.median_psm.toLocaleString()}/m²` : 'N/A'
    };

    try {
      // Call the server-side /api/chat endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          model: selectedModel,
          contextData
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned error ${response.status}`);
      }

      const data = await response.json();

      const modelMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: data.content || 'I could not generate an answer at this moment.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: data.model || selectedModel
      };

      setMessages((prev) => [...prev, modelMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `⚠️ **Unable to connect**: ${err?.message || 'Failed to communicate with Gemini.'}\n\nPlease verify that your \`GEMINI_API_KEY\` is configured in the AI Studio Settings > Secrets panel.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to format basic markdown-style text (bold, bullet points, headers)
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');

    return (
      <div className="space-y-1.5 leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1" />;
          }

          // Bullet points
          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            const bulletText = line.trim().substring(2);
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1 text-xs">
                <span className="text-blue-500 font-bold mt-0.5">•</span>
                <span>{renderInlineMarkdown(bulletText)}</span>
              </div>
            );
          }

          // Numbered list
          if (/^\d+\.\s/.test(line.trim())) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1 text-xs">
                <span className="text-slate-500 font-semibold">{line.trim().split(' ')[0]}</span>
                <span>{renderInlineMarkdown(line.trim().substring(line.trim().indexOf(' ') + 1))}</span>
              </div>
            );
          }

          return (
            <p key={idx} className="text-xs">
              {renderInlineMarkdown(line)}
            </p>
          );
        })}
      </div>
    );
  };

  // Inline markdown formatter for bold, code, and links
  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={index}
            className="px-1 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Gemini Chatbot Avatar in Bottom Right Corner */}
      <div className="fixed bottom-5 right-5 z-[999] flex flex-col items-end pointer-events-auto">
        {/* Welcome popover pill if unopened */}
        {!hasOpenedOnce && !isOpen && (
          <div
            onClick={handleOpen}
            className="mb-2 bg-white/95 backdrop-blur-sm px-3.5 py-2 rounded-xl shadow-lg border border-slate-200 text-xs text-slate-800 flex items-center gap-2 cursor-pointer hover:bg-slate-50 transition-all animate-bounce"
          >
            <Sparkles className="w-4 h-4 text-purple-600 fill-purple-100" />
            <span className="font-medium">Need HDB insights? Ask Gemini</span>
            <X
              className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                setHasOpenedOnce(true);
              }}
            />
          </div>
        )}

        {/* Avatar Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close Gemini Assistant' : 'Open Gemini Assistant'}
          className={`relative group p-3.5 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center ${
            isOpen
              ? 'bg-slate-900 text-white rotate-90 hover:bg-slate-800'
              : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white hover:scale-105 hover:shadow-blue-500/25'
          }`}
        >
          {/* Shimmering pulse effect */}
          {!isOpen && (
            <span className="absolute -inset-1 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 opacity-40 blur-xs group-hover:opacity-75 animate-pulse" />
          )}

          <div className="relative flex items-center justify-center">
            {isOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <>
                <Bot className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
                </span>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Slide-in Chat Popover / Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Gemini HDB Advisor Chat"
          className="fixed bottom-20 right-5 z-[999] w-[calc(100vw-32px)] sm:w-[420px] max-h-[620px] h-[calc(100vh-120px)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-3.5 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white border border-white/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                  <span>Gemini HDB Advisor</span>
                  <span className="text-[10px] font-normal px-1.5 py-0.2 bg-white/20 rounded-full">
                    AI
                  </span>
                </h3>
                <p className="text-[11px] text-blue-100 flex items-center gap-1">
                  <span>Singapore Property Intelligence</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                title="Clear conversation history"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Model Selector Bar */}
          <div className="bg-slate-50 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="gemini-3.5-flash">gemini-3.5-flash (Balanced)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast)</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex)</option>
              </select>
            </div>

            {currentData && (
              <span className="text-slate-500 truncate max-w-[150px]">
                {currentFilters?.town || 'Islandwide'} ({currentData.count} txns)
              </span>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3 shadow-xs relative group text-xs ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  {/* Message content */}
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    renderFormattedContent(msg.content)
                  )}

                  {/* Message Footer */}
                  <div
                    className={`flex items-center justify-between gap-2 mt-2 pt-1 border-t text-[10px] ${
                      msg.role === 'user'
                        ? 'border-blue-500 text-blue-100'
                        : 'border-slate-100 text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>

                    {msg.role === 'model' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="hover:text-slate-700 flex items-center gap-0.5"
                          title="Copy message"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Thinking / Loading Animation */}
            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs p-3 shadow-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] text-slate-500 ml-1.5 font-medium">
                    Gemini is thinking...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions (if few messages) */}
          {messages.length <= 2 && !isLoading && (
            <div className="px-3 py-2 bg-slate-100/70 border-t border-slate-200 overflow-x-auto no-scrollbar flex gap-1.5">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  className="shrink-0 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-[11px] text-slate-700 font-medium transition-colors hover:border-blue-400"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Form */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2"
            >
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all p-1.5">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about HDB prices, grants, MOP, estates..."
                  rows={2}
                  className="w-full bg-transparent resize-none border-0 p-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="text-[10px] text-slate-400 text-center mt-1.5">
              Gemini provides insights based on Singapore open data. Verify on HDB Flat Portal.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
