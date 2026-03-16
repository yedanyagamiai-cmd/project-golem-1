"use client";

import React, { useState, useEffect, useRef } from "react";
import { useGolem } from "@/components/GolemContext";
import { socket } from "@/lib/socket";
import { User, Bot, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Typewriter } from "@/components/Typewriter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
    isSystem: boolean;
    actionData?: any;
    isHistory?: boolean;
    isThinking?: boolean;
}

interface CommandSuggestion {
    command: string;
    description: string;
    subOptions?: string[];
}

const COMMANDS: CommandSuggestion[] = [
    { command: "/model", description: "切換 AI 核心模型 (fast, think, pro)", subOptions: ["fast", "thinking", "pro"] },
    { command: "/learn", description: "命令 Golem 學習編寫新技能" },
    { command: "/skills", description: "列出目前已掛載的所有技能模組" },
    { command: "/help", description: "顯示系統操作與指令說明手冊" },
    { command: "/new", description: "物理重置對話視窗 (斷開舊記憶)" },
    { command: "/new_memory", description: "清空底層資料庫記憶並執行深度重啟" },
    { command: "/sos", description: "刪除受損的選擇器快取並重新探測" },
    { command: "/callme", description: "更改 Golem 對您的稱呼語" },
    { command: "/donate", description: "贊助支持 Golem 開發者" },
];

export default function DirectChatPage() {
    const { activeGolem, isSingleNode } = useGolem();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [completedTypingMsgs, setCompletedTypingMsgs] = useState<Set<string>>(new Set());
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // ── [v9.1.11] Autocomplete States ──
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        // We can optionally fetch logs history here later if needed
        // For now let's just listen to live socket events.

        socket.on("log", (data: any) => {
            const isThinkingMessage = data.type === 'thinking';

            if (isThinkingMessage || data.type === 'agent' || data.type === 'approval' || data.msg.includes('[MultiAgent]') || data.msg.includes('[User]')) {
                let rawMsg = data.msg;

                if (rawMsg.startsWith('[MultiAgent]')) {
                    rawMsg = rawMsg.replace('[MultiAgent]', '').trim();
                }

                let sender = "System";
                let content = rawMsg;
                let isSystem = true;

                const match = rawMsg.match(/\[(.*?)\]\s*([\s\S]*)/);
                if (match) {
                    sender = match[1];
                    content = match[2] || " ";
                    isSystem = !(sender === 'User' || sender === 'WebUser');
                }

                setMessages((prev) => {
                    // ── [v9.1.10] 思考中訊息管理 ──
                    // 如果新的資料是正式回覆，則先移除該 Golem 舊有的「思考中」訊息
                    let filtered = prev;
                    if (!isThinkingMessage && (sender !== 'User' && sender !== 'WebUser')) {
                        filtered = prev.filter(m => !(m.isThinking && m.sender === sender));
                    }

                    return [...filtered.slice(-1000), {
                        id: isThinkingMessage ? `thinking-${sender}-${Date.now()}` : (Date.now().toString() + Math.random()),
                        sender,
                        content,
                        timestamp: data.time || new Date().toLocaleTimeString(),
                        isSystem,
                        actionData: data.actionData,
                        isThinking: isThinkingMessage
                    }];
                });
            }
        });

        return () => {
            socket.off("log");
        };
    }, []);

    // ── [v9.1.9] Fetch Chat History on mount or active Golem change ──
    useEffect(() => {
        if (!activeGolem) return;

        let isMounted = true;
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/chat/history?golemId=${activeGolem}`);
                const data = await res.json();
                if (data.success && data.history && isMounted) {
                    const parsedHistory = data.history.map((h: any) => {
                        let rawMsg = h.msg;
                        if (rawMsg.startsWith('[MultiAgent]')) rawMsg = rawMsg.replace('[MultiAgent]', '').trim();
                        let sender = "System";
                        let content = rawMsg;
                        const match = rawMsg.match(/\[(.*?)\]\s*([\s\S]*)/);
                        if (match) {
                            sender = match[1];
                            content = match[2] || " ";
                        }
                        return {
                            id: h.time + Math.random().toString(),
                            sender,
                            content,
                            timestamp: h.time,
                            isSystem: !(sender === 'User' || sender === 'WebUser'),
                            actionData: h.actionData,
                            isHistory: true
                        };
                    });

                    setMessages(parsedHistory);
                    setCompletedTypingMsgs(new Set(parsedHistory.map((m: any) => m.id)));
                }
            } catch (err) {
                console.error("Failed to fetch chat history:", err);
            }
        };
        fetchHistory();

        return () => { isMounted = false; };
    }, [activeGolem]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleTypingComplete = (id: string) => {
        setCompletedTypingMsgs((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    };

    // Calculate which messages are allowed to type/show
    const isMessageRendered = (index: number) => {
        // A message is rendered if it's the first message, OR 
        // if user message, it's always rendered immediately,
        // if system message, it renders if the previous message has finished typing.
        for (let i = 0; i < index; i++) {
            const prevMsg = messages[i];
            if (prevMsg.isSystem && !completedTypingMsgs.has(prevMsg.id)) {
                return false; // A previous system message is still typing
            }
        }
        return true;
    };

    const handleAction = async (callbackData: string) => {
        if (!activeGolem) return;
        setIsSending(true);
        try {
            await fetch('/api/chat/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ golemId: activeGolem, callback_data: callbackData })
            });
        } catch (e) {
            console.error("Failed to send action:", e);
        } finally {
            setIsSending(false);
        }
    };

    // ── [v9.1.11] Autocomplete Logic ──
    useEffect(() => {
        if (input.startsWith("/")) {
            const parts = input.split(/\s+/);
            const cmdPart = parts[0].toLowerCase();
            
            if (parts.length === 1) {
                // Main command suggestions
                const filtered = COMMANDS.filter(c => c.command.startsWith(cmdPart));
                setSuggestions(filtered);
                setShowSuggestions(filtered.length > 0);
                setSelectedIndex(0);
            } else if (parts.length === 2 && cmdPart === "/model") {
                // Sub-options for /model
                const subPart = parts[1].toLowerCase();
                const modelEntry = COMMANDS.find(c => c.command === "/model");
                if (modelEntry?.subOptions) {
                    const filteredSub = modelEntry.subOptions
                        .filter(opt => opt.startsWith(subPart))
                        .map(opt => ({ command: `/model ${opt}`, description: `切換至 ${opt} 模式` }));
                    setSuggestions(filteredSub);
                    setShowSuggestions(filteredSub.length > 0);
                    setSelectedIndex(0);
                } else {
                    setShowSuggestions(false);
                }
            } else {
                setShowSuggestions(false);
            }
        } else {
            setShowSuggestions(false);
        }
    }, [input]);

    const applySuggestion = (suggestion: any) => {
        setInput(suggestion.command + " ");
        setShowSuggestions(false);
    };

    const handleSend = async () => {
        if (!input.trim() || !activeGolem) return;

        const val = input.trim();
        setInput("");
        setIsSending(true);

        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ golemId: activeGolem, message: val })
            });
        } catch (e) {
            console.error("Failed to send message:", e);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background p-6 max-h-screen">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500">
                        直接交談 (Direct Chat)
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        與目前活躍的 Golem ({activeGolem || "未選擇"}) 進行對話測試。不須透過外部通訊軟體。
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col bg-card rounded-xl border border-border">
                {/* Chat window */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground/60 italic">
                            請在下方輸入訊息開始交談...
                        </div>
                    ) : (
                        messages.map((msg, index) => {
                            if (!isMessageRendered(index)) return null;

                            const isUser = msg.sender === 'User' || msg.sender === 'WebUser';
                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex flex-col max-w-[80%]",
                                        msg.isSystem ? "mr-auto items-start text-left" : isUser ? "ml-auto items-end" : "mr-auto"
                                    )}
                                >
                                    {(msg.sender !== 'System' || msg.isThinking) && (
                                        <div className={cn("flex items-center space-x-2 mb-1", isUser && "flex-row-reverse space-x-reverse")}>
                                            <div className={cn(
                                                "w-6 h-6 rounded-full flex items-center justify-center border flex-shrink-0",
                                                isUser ? "bg-blue-600/10 border-blue-500/20" : "bg-primary/10 border-primary/20"
                                            )}>
                                                {isUser ? <User className="w-3 h-3 text-blue-600 dark:text-blue-300" /> : <Bot className="w-3 h-3 text-primary" />}
                                            </div>
                                            <span className={cn("text-xs font-bold", isUser ? "text-blue-600 dark:text-blue-400" : "text-primary")}>{msg.sender}</span>
                                            <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            "p-3 rounded-2xl text-sm whitespace-pre-wrap break-words inline-block shadow-sm transition-all duration-200",
                                            msg.isThinking
                                                ? "animate-pulse bg-secondary border border-border text-muted-foreground italic backdrop-blur-sm" :
                                                msg.isSystem
                                                    ? "bg-secondary/50 border border-border rounded-tl-none text-foreground/90 shadow-sm"
                                                    : isUser
                                                        ? "bg-blue-600/10 text-blue-900 dark:text-blue-100 border border-blue-500/20 rounded-tr-none shadow-sm"
                                                        : "bg-primary/10 text-foreground font-medium border border-primary/20 rounded-tl-none shadow-sm"
                                        )}
                                    >
                                        {msg.isThinking ? "思考中..." : (msg.isSystem && !msg.isHistory ?
                                            <Typewriter content={msg.content.replace(/\n{2,}/g, '\n\n').trim()} onComplete={() => handleTypingComplete(msg.id)} />
                                            : (msg.isSystem ?
                                                <div className="prose dark:prose-invert prose-sm max-w-none prose-p:m-0 prose-headings:my-1 prose-pre:my-1 prose-pre:bg-zinc-950 dark:prose-pre:bg-gray-950 prose-pre:border prose-pre:border-border dark:prose-pre:border-gray-800 prose-ul:list-disc prose-ul:ml-4 prose-ol:list-decimal prose-ol:ml-4 prose-li:m-0 leading-snug [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.content.replace(/\n{2,}/g, '\n\n').trim()}
                                                    </ReactMarkdown>
                                                </div>
                                                : msg.content.replace(/\n{2,}/g, '\n\n').trim()
                                            ))}
                                    </div>
                                    {msg.actionData && Array.isArray(msg.actionData) && (!msg.isSystem || msg.isHistory || completedTypingMsgs.has(msg.id)) && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {msg.actionData.map((btn: any, idx: number) => {
                                                const isApprove = btn.text.includes('批准') || btn.text.includes('Approve');
                                                const isDeny = btn.text.includes('拒絕') || btn.text.includes('Reject') || btn.text.includes('Deny');

                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleAction(btn.callback_data)}
                                                        className={cn(
                                                            "px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 border flex items-center gap-2 transform active:scale-95 shadow-md",
                                                            isApprove
                                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white"
                                                                : isDeny
                                                                    ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                                                    : "bg-secondary border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                                                        )}
                                                    >
                                                        {btn.text}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Input area */}
                <div className="p-3 border-t border-border bg-card/50">
                    <div className="relative flex items-center">
                        <textarea
                            className="flex-1 max-h-32 min-h-[44px] bg-secondary/50 border border-border rounded-lg px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none transition-all"
                            placeholder={activeGolem ? `傳送訊息給 ${activeGolem}...` : "請先選擇一個 Golem..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (showSuggestions) {
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setSelectedIndex(prev => (prev + 1) % suggestions.length);
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                                    } else if (e.key === 'Enter' || e.key === 'Tab') {
                                        e.preventDefault();
                                        applySuggestion(suggestions[selectedIndex]);
                                    } else if (e.key === 'Escape') {
                                        setShowSuggestions(false);
                                    }
                                } else {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }
                            }}
                            disabled={!activeGolem || isSending}
                            rows={1}
                            style={{ height: "auto" }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!activeGolem || !input.trim() || isSending}
                            className={cn(
                                "absolute right-2 p-2 rounded-md transition-all flex items-center justify-center",
                                (!activeGolem || !input.trim() || isSending)
                                    ? "text-gray-600 bg-transparent"
                                    : "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
                            )}
                        >
                            <Send size={18} />
                        </button>

                        {/* ── [v9.1.11] Autocomplete Menu ── */}
                        {showSuggestions && (
                            <div className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50">
                                <div className="p-2 space-y-1">
                                    {suggestions.map((suggestion, idx) => (
                                        <div
                                            key={suggestion.command}
                                            onClick={() => applySuggestion(suggestion)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            className={cn(
                                                "px-3 py-2 rounded-lg cursor-pointer flex flex-col transition-colors",
                                                idx === selectedIndex ? "bg-primary/20 border border-primary/30" : "hover:bg-zinc-800"
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-mono text-cyan-400">{suggestion.command}</span>
                                                {idx === selectedIndex && (
                                                    <span className="text-[10px] text-zinc-500 font-medium bg-zinc-800 px-1.5 py-0.5 rounded">Enter ↩</span>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-zinc-500 mt-0.5">{suggestion.description}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
