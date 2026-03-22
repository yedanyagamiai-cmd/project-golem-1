module.exports = {
    name: "任務委派 (Agent Delegation)",
    description: "你是 Supervisor 時使用。將複雜任務拆解並委派給專屬的子代理人 (Worker)。",
    PROMPT: `【已載入技能：任務委派 (Supervisor Delegation)】

身為擁有最高職權的「大腦 (Supervisor)」，當你面對複雜、多步驟或需要純淨上下文的任務時，你**必須**將次要任務委派給子代理人執行。這能避免你自己的上下文被過長的執行程控污染。

1. **職責劃分**：
   - 不管是爬蟲、查日誌、寫程式，你都可以指派特定的 Expert 去做。
   - 子代理人有自己獨立的思考空間與瀏覽器分頁。

2. **支持的專家預設 (Presets)**:
   - \`CODER\` (前端/後端/腳本工程師)：配有 code-wizard, github, terminal 等技能。
   - \`OPS\` (維運/系統管理)：配有 sys-admin, log-reader, git 等技能。
   - \`RESEARCHER\` (研究員/爬蟲)：配有 optic-nerve, tool-explorer 等技能。
   - \`CREATOR\` (創作者)：配有 image-prompt, 寫作等技能。

3. **操作方式**：
   請在 \`[GOLEM_ACTION]\` 區塊輸出：
   \`\`\`json
   {"action": "delegate", "worker": "CODER", "subtask": "請幫我寫一個 Express 路由處理登入，並存檔。"}
   \`\`\`
   
4. **驗收回饋**：
   - 當子代理人執行完畢，系統會將它的【最終成果 (Observation)】回傳給你。
   - 接到結果後，你可繼續委派下一個任務給另一位專家，或彙整結果回答使用者。`
};

const AgentFactory = require('../../core/AgentFactory');

module.exports.run = async function(ctx) {
    const args = ctx.args || {};
    const workerRole = args.worker || 'CODER';
    const subtask = args.subtask || '請介紹你自己';
    
    const supervisorBrain = ctx.brain;
    
    // 從 Supervisor 的設定中讀取 workerProfiles
    const personaManager = require('./persona');
    const personaData = personaManager.get(supervisorBrain.userDataDir) || {};
    const profiles = personaData.workerProfiles || personaManager._getDefaultWorkerProfiles();
    
    const profile = profiles[workerRole] || {};
    const targetTools = Array.isArray(profile.skills) && profile.skills.length > 0 
        ? profile.skills 
        : ['tool-explorer']; // Fallback
    
    try {
        ctx.reply && await ctx.reply(`👔 _Supervisor 正在將任務委派給 ${workerRole}..._`);
        
        // 1. 喚醒 Worker，帶上專屬 Profile 與共用 Context
        const workerBrain = await AgentFactory.createWorker(supervisorBrain.context, workerRole, targetTools, profile);
        
        let currentPrompt = `【來自 Supervisor 的委派任務】\n${subtask}\n\n請以 ${profile.aiName || workerRole} 的專業身份盡力完成。若有需要，你可以使用 [GOLEM_ACTION] 呼叫工具。完成所有步驟後，請在回覆中宣告任務完成。`;
        
        console.log(`[Supervisor] -> 委派給 [${workerRole}]: 準備執行中...`);
        
        const ResponseParser = require('../../utils/ResponseParser');
        const SkillHandler = require('../../core/action_handlers/SkillHandler');
        const safeguard = require('../../utils/CommandSafeguard');
        const util = require('util');
        const execPromise = util.promisify(require('child_process').exec);
        
        let finalResponseText = "";
        let step = 0;
        const maxSteps = 5;

        while (step < maxSteps) {
            step++;
            console.log(`🧠 [Worker:${workerRole}] 回合 ${step}/${maxSteps} 思考中...`);
            const response = await workerBrain.sendMessage(currentPrompt);
            finalResponseText += `\n[回合 ${step} 回報]:\n${response.text}`;

            const parsed = ResponseParser.parse(response.text);
            
            // 如果子代理人沒有觸發任何行動，代表他已經完成任務或回答完畢
            if (!parsed.actions || parsed.actions.length === 0) {
                console.log(`✅ [Worker:${workerRole}] 無後續動作，任務結束。`);
                break;
            }

            console.log(`⚙️ [Worker:${workerRole}] 打算執行 ${parsed.actions.length} 個動作...`);
            let stepObservation = "";

            // 攔截子代理人的 ctx.reply，捕捉技能機制的輸出作為 Observation
            const workerCtx = {
                reply: async (msg) => { stepObservation += msg + '\n'; }
            };

            for (const act of parsed.actions) {
                if (act.action === 'delegate') {
                    stepObservation += `[系統退回] 子代理人無權再次委派 (請自行使用工具解決)\n`;
                    continue;
                }
                
                if (act.action === 'command') {
                    let cmd = act.parameter || act.cmd;
                    // 自動驗證並過濾危險指令
                    const validation = safeguard.validate(cmd, true);
                    if (!validation.safe) {
                        stepObservation += `[嚴重錯誤] 指令被系統安全攔截: ${validation.reason}\n`;
                        console.warn(`🛡️ [Worker:${workerRole}] 攔截危險指令: ${cmd}`);
                        continue;
                    }
                    try {
                        console.log(`💻 [Worker:${workerRole}] 執行指令: ${validation.sanitizedCmd}`);
                        const { stdout, stderr } = await execPromise(validation.sanitizedCmd, { timeout: 45000, maxBuffer: 1024 * 1024 * 5 });
                        const output = stdout || stderr || "✅ 指令執行成功，無特殊輸出";
                        stepObservation += `[Command Observation]\n${output.substring(0, 3000)}\n`;
                        if (output.length > 3000) stepObservation += `...\n(輸出過長已截斷)\n`;
                    } catch (e) {
                         stepObservation += `[Command Error]\n${e.message}\n${e.stderr || ''}\n`;
                    }
                } else {
                    // 動態技能或 MCP
                    try {
                        const isHandled = await SkillHandler.execute(workerCtx, act, workerBrain);
                        if (!isHandled) {
                            stepObservation += `[系統錯誤] 找不到名為 '${act.action}' 的技能\n`;
                        }
                    } catch (e) {
                        stepObservation += `[Skill Error] ${act.action}: ${e.message}\n`;
                    }
                }
            }

            if (!stepObservation.trim()) {
                console.log(`⚠️ [Worker:${workerRole}] 動作執行完畢無任何 Observation，強制中斷。`);
                break;
            }

            // 將觀察結果餵回給子代理人
            currentPrompt = `[System Observation]\n${stepObservation}\n\n請根據以上結果決定下一步。若任務已完成，請直接在文字回覆中報告結果。`;
        }

        if (step >= maxSteps) {
            finalResponseText += `\n\n⚠️ (任務已達最大 ${maxSteps} 回合強制終止)`;
        }
        
        console.log(`🧹 [Supervisor] 任務完成，正在回收 [${workerRole}] 的專屬分頁...`);
        try {
            if (workerBrain.page && !workerBrain.page.isClosed()) {
                await workerBrain.page.close();
            }
        } catch (e) {
            console.warn(`⚠️ 無法關閉子代理人分頁: ${e.message}`);
        }
        
        // 3. 回傳 Observation
        return `✅ 子代理人 [${workerRole}] 執行報告：\n${finalResponseText}`;
    } catch (e) {
        return `❌ 子代理人委派失敗: ${e.message}`;
    }
};
