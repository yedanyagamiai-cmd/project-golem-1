"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Cpu, Save, RotateCcw, Box, Terminal, Zap, BookOpen, Bot, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// A reused local component for simple editable fields
function EditField({ label, value, onChange, placeholder, multiline = false, className = "" }: {
    label: string, 
    value: string, 
    onChange: (v: string) => void, 
    placeholder?: string,
    multiline?: boolean,
    className?: string
}) {
    return (
        <div className={cn("space-y-1.5", className)}>
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            {multiline ? (
                <textarea 
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 min-h-[80px] font-sans resize-y"
                />
            ) : (
                <input 
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 font-sans"
                />
            )}
        </div>
    );
}

function SkillChips({
    availableSkills,
    selectedSkills,
    onChange
}: {
    availableSkills: {id: string, name: string}[],
    selectedSkills: string[],
    onChange: (skills: string[]) => void
}) {
    const handleToggle = (skillId: string) => {
        if (selectedSkills.includes(skillId)) {
            onChange(selectedSkills.filter(s => s !== skillId));
        } else {
            onChange([...selectedSkills, skillId]);
        }
    }
    
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">預設裝載技能 (點擊切換)</label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-background/50 border border-border rounded-lg min-h-[42px]">
                {availableSkills.map(s => {
                    const isSelected = selectedSkills.includes(s.id);
                    return (
                        <button
                            key={s.id}
                            onClick={() => handleToggle(s.id)}
                            className={cn(
                                "px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all flex items-center gap-1",
                                isSelected 
                                    ? "bg-primary text-primary-foreground border-primary" 
                                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                            )}
                            title={s.name}
                        >
                            {isSelected && <Zap className="w-3 h-3" />}
                            {s.id}
                        </button>
                    )
                })}
                {availableSkills.length === 0 && <span className="text-xs text-muted-foreground">載入技能中...</span>}
            </div>
        </div>
    )
}

export default function SubAgentsPage() {
    const [workerProfiles, setWorkerProfiles] = useState<Record<string, any>>({});
    const [savedProfiles, setSavedProfiles] = useState<Record<string, any>>({});
    const [availableSkills, setAvailableSkills] = useState<{id: string, name: string}[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{type: "info"|"error", text: string} | null>(null);

    // Initial load from `/api/persona` API and `/api/skills`
    useEffect(() => {
        Promise.all([
            fetch("/api/persona").then(r => r.json()),
            fetch("/api/skills").then(r => r.json())
        ])
        .then(([personaData, skillsData]) => {
            if (personaData && !personaData.error) {
                const profiles = personaData.workerProfiles || {};
                setWorkerProfiles(profiles);
                setSavedProfiles(JSON.parse(JSON.stringify(profiles)));
            }
            if (skillsData && skillsData.skills) {
                setAvailableSkills(skillsData.skills);
            }
        })
        .catch(err => {
            console.error("Failed to fetch data", err);
        });
    }, []);

    useEffect(() => {
        setIsDirty(JSON.stringify(workerProfiles) !== JSON.stringify(savedProfiles));
    }, [workerProfiles, savedProfiles]);

    const handleDiscard = () => {
        setWorkerProfiles(JSON.parse(JSON.stringify(savedProfiles)));
        setIsDirty(false);
        setStatusMsg(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatusMsg(null);
        try {
            // Re-fetch the current full persona to ensure we only update workerProfiles
            const currentRes = await fetch("/api/persona");
            const currentData = await currentRes.json();
            
            const payload = {
                ...currentData,
                workerProfiles: workerProfiles
            };

            const res = await fetch("/api/persona/inject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (res.ok && result.success) {
                setSavedProfiles(JSON.parse(JSON.stringify(workerProfiles)));
                setIsDirty(false);
                setStatusMsg({ type: "info", text: "✅ 子代理專家設定儲存成功！將於下次呼叫時生效。" });
            } else {
                throw new Error(result.error || "儲存失敗");
            }
        } catch (e: any) {
            setStatusMsg({ type: "error", text: `❌ 錯誤: ${e.message}` });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddAgent = () => {
        const role = window.prompt("請輸入新專家的代號 (建議全大寫英文，例如：QA, WRITER, ANALYST)");
        if (!role) return;
        const upperRole = role.trim().toUpperCase();
        if (workerProfiles[upperRole]) {
            alert("該專家代號已存在！");
            return;
        }
        setWorkerProfiles(prev => ({
            ...prev,
            [upperRole]: {
                aiName: "New Expert",
                skills: [],
                tone: "專業、精準",
                currentRole: `身為一名資深的 ${upperRole}，你的任務是...`
            }
        }));
    };

    const handleDeleteAgent = (role: string) => {
        if (!window.confirm(`確定要刪除 ${role} 專家設定嗎？這無法復原。`)) return;
        setWorkerProfiles(prev => {
            const next = { ...prev };
            delete next[role];
            return next;
        });
    };

    const PREDEFINED_ICONS: Record<string, any> = {
        CODER: Terminal,
        RESEARCHER: BrainCircuit,
        OPS: Cpu,
        CREATOR: Zap,
    };

    const PREDEFINED_COLORS: Record<string, string> = {
        CODER: "text-blue-400",
        RESEARCHER: "text-purple-400",
        OPS: "text-orange-400",
        CREATOR: "text-pink-400",
    };

    const PREDEFINED_TITLES: Record<string, string> = {
        CODER: "程式開發專家",
        RESEARCHER: "資料研究專家",
        OPS: "系統維運專家",
        CREATOR: "內容創作專家",
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary" />
                        子代理專家 (Sub-Agents)
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        為你的 Golem 設計多個專屬的子代理專家。可動態新增專家與指派技能。
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        variant="outline" 
                        onClick={handleAddAgent}
                        className="bg-accent hover:bg-accent/80 border-transparent text-foreground"
                        disabled={isSaving}
                    >
                        <Plus className="w-4 h-4 mr-2" /> 新增專家
                    </Button>
                    {isDirty && (
                        <Button 
                            variant="outline" 
                            onClick={handleDiscard}
                            className="bg-accent/50 hover:bg-accent border-transparent"
                            disabled={isSaving}
                        >
                            <RotateCcw className="w-4 h-4 mr-2" /> 復原
                        </Button>
                    )}
                    <Button 
                        onClick={handleSave} 
                        disabled={!isDirty || isSaving}
                        className={cn("bg-primary text-primary-foreground hover:bg-primary/90", isDirty && "animate-pulse")}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? "儲存中..." : "儲存設定"}
                    </Button>
                </div>
            </div>

            {/* Status Message */}
            {statusMsg && (
                <div className={cn(
                    "mx-6 mt-4 p-3 rounded-xl border text-sm font-medium animate-in fade-in slide-in-from-top-2",
                    statusMsg.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                )}>
                    {statusMsg.text}
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1400px] mx-auto">
                    {Object.keys(workerProfiles).map((roleKey) => {
                        const profile = workerProfiles[roleKey] || {};
                        const Icon = PREDEFINED_ICONS[roleKey] || Bot;
                        const colorClass = PREDEFINED_COLORS[roleKey] || "text-emerald-400";
                        const title = PREDEFINED_TITLES[roleKey] || "自訂專家";
                        
                        return (
                            <div key={roleKey} className="bg-card border border-border rounded-xl flex flex-col shadow-sm relative group overflow-hidden">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:bg-red-500/20 hover:text-red-400 z-10 rounded-lg"
                                    onClick={() => handleDeleteAgent(roleKey)}
                                    title="刪除專家"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>

                                <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-background border flex items-center justify-center shadow-sm">
                                            <Icon className={cn("w-5 h-5", colorClass)} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                                                {title} <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase font-mono">{roleKey}</span>
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-5 space-y-5 flex-1 bg-gradient-to-b from-transparent to-muted/10">
                                    <EditField 
                                        label="AI 顯示名稱" 
                                        value={profile.aiName || ""} 
                                        onChange={v => setWorkerProfiles(prev => ({...prev, [roleKey]: {...(prev[roleKey] || {}), aiName: v}}))} 
                                        placeholder="例如：DevMaster" 
                                    />
                                    
                                    <SkillChips 
                                        availableSkills={availableSkills}
                                        selectedSkills={profile.skills || []}
                                        onChange={selected => setWorkerProfiles(prev => ({...prev, [roleKey]: {...(prev[roleKey] || {}), skills: selected}}))}
                                    />
                                    
                                    <EditField 
                                        label="語言風格 & 語氣" 
                                        value={profile.tone || ""} 
                                        onChange={v => setWorkerProfiles(prev => ({...prev, [roleKey]: {...(prev[roleKey] || {}), tone: v}}))}
                                        placeholder="例如：精準、理智、幽默" 
                                    />
                                    
                                    <EditField 
                                        label="專家系統提示詞 (System Prompt)" 
                                        value={profile.currentRole || ""} 
                                        onChange={v => setWorkerProfiles(prev => ({...prev, [roleKey]: {...(prev[roleKey] || {}), currentRole: v}}))} 
                                        multiline
                                        className="flex-1"
                                        placeholder={`描述此專家的背景任務...`} 
                                    />
                                </div>
                            </div>
                        )
                    })}
                    
                    {Object.keys(workerProfiles).length === 0 && (
                        <div className="col-span-1 md:col-span-2 p-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                            <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>目前沒有任何子代理專家，點擊右上角「新增專家」開始建立你的 AI 團隊！</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
