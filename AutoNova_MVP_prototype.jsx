
import { useState, useRef, useEffect } from "react";

// ─── KNOWLEDGE BASE (тестовые данные) ────────────────────────────────────────
const KB = {
  models: [
    { name: "Nova Comfort", type: "Седан", price: 1800000, configs: ["Base", "Standard", "Premium"] },
    { name: "Nova Drive",   type: "Кроссовер", price: 2400000, configs: ["Standard", "Premium", "Sport"] },
    { name: "Nova Cargo",   type: "Фургон",  price: 2100000, configs: ["Base", "Standard"] },
    { name: "Nova Classic", type: "Седан б/у", price: 950000, configs: [] },
  ],
  finance: {
    credit:  { minDown: 20, maxTerm: 60, rate: 9.9 },
    leasing: { minDown: 10, maxTerm: 48, rate: 8.5 },
  },
  warranty: {
    factory: "3 года или 100 000 км (при соблюдении регламента ТО)",
    body:    "6 лет (сквозная коррозия)",
    paint:   "1 год (заводской брак)",
  },
  maintenance: "Регламентное ТО каждые 15 000 км или 1 раз в год.",
  orders: {
    "АН-2024-0512": { model: "Nova Drive Premium", color: "серебристый", status: "Предпродажная подготовка", eta: "3 рабочих дня" },
    "АН-2024-0388": { model: "Nova Comfort Standard", color: "белый", status: "В пути со склада", eta: "5 рабочих дней" },
  },
};

// ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────
const SYSTEM_ORCHESTRATOR = `
Ты — AI Orchestrator компании AutoNova (вымышленная автомобильная компания, учебный проект).
Твоя задача: определить намерение пользователя и назвать агента, которому передаёшь обращение.

Агенты:
- SALES_AGENT — покупка, подбор авто, кредит, лизинг, trade-in, тест-драйв
- SUPPORT_AGENT — статус заказа, документы, общие вопросы, возврат
- SERVICE_AGENT — гарантия, ТО, запись в сервис, ремонт, эксплуатация

Правила:
1. Поздоровайся кратко и определи тему.
2. Ответь JSON строго в формате:
{"agent":"SALES_AGENT"|"SUPPORT_AGENT"|"SERVICE_AGENT","greeting":"<короткое приветствие 1 предложение>"}
3. Ничего кроме JSON не пиши.
`.trim();

const SYSTEM_SALES = `
Ты — Sales Agent компании AutoNova (учебный проект, все данные вымышлены).
Помогаешь клиентам выбрать автомобиль, рассчитать кредит/лизинг, оформить trade-in, записаться на тест-драйв.

БАЗА ЗНАНИЙ (используй только эти данные):
Модели:
- Nova Comfort (Седан) — от 1 800 000 руб. Комплектации: Base, Standard, Premium
- Nova Drive (Кроссовер) — от 2 400 000 руб. Комплектации: Standard, Premium, Sport
- Nova Cargo (Фургон) — от 2 100 000 руб. Комплектации: Base, Standard
- Nova Classic (Седан б/у) — от 950 000 руб.

Кредит: первый взнос от 20%, срок 12–60 мес., ставка от 9,9% годовых.
Лизинг B2B: первый взнос от 10%, срок 12–48 мес., ставка от 8,5% годовых.
Trade-in: предварительная оценка по марке/модели/году/пробегу, финальная — у менеджера.
Тест-драйв: запись по имени, телефону, модели и дате.

Правила:
- Отвечай на языке клиента (русский).
- Не придумывай данные вне базы знаний.
- Не подтверждай гарантийные случаи.
- Не обещай скидки сверх базы.
- При запросе на подписание договора или точный расчёт кредита: "Передаю менеджеру."
- Информируй, что ты ИИ-ассистент.
- Краткие, конкретные ответы. Без давления.
`.trim();

const SYSTEM_SUPPORT = `
Ты — Customer Support Agent компании AutoNova (учебный проект, все данные вымышлены).
Помогаешь клиентам по вопросам заказов, документов, статусов.

БАЗА ЗНАНИЙ — заказы (тестовые):
- АН-2024-0512: Nova Drive Premium, серебристый — Статус: Предпродажная подготовка, выдача через 3 рабочих дня
- АН-2024-0388: Nova Comfort Standard, белый — Статус: В пути со склада, выдача через 5 рабочих дней

Документы для покупки: паспорт, ИНН. Для кредита/лизинга — справка о доходах.
Возврат: регулируется договором и законом о защите прав потребителей — передаётся специалисту.

Правила:
- Отвечай кратко и по существу.
- Не изменяй данные клиента.
- Не принимай решений о возврате — передай специалисту.
- При нестандартной ситуации: "Передаю специалисту."
- Информируй, что ты ИИ-ассистент.
`.trim();

const SYSTEM_SERVICE = `
Ты — Service Agent компании AutoNova (учебный проект, все данные вымышлены).
Консультируешь по гарантии, ТО, эксплуатации, записываешь в сервис.

БАЗА ЗНАНИЙ:
Гарантия:
- Заводская: 3 года или 100 000 км при соблюдении регламента ТО
- Кузов: 6 лет (сквозная коррозия)
- ЛКП: 1 год (заводской брак)

ТО: каждые 15 000 км или 1 раз в год.
ТО-1 (15 000): масло, фильтры.
ТО-2 (30 000): масло, фильтры, тормозная жидкость.
ТО-3 (45 000): масло, фильтры, диагностика тормозной системы.

Правила:
- Не подтверждай гарантийный случай — только инженер после осмотра.
- При серьёзной поломке или ДТП: "Передаю инженеру."
- Не давай советов по сложному самостоятельному ремонту.
- Информируй, что ты ИИ-ассистент.
- Краткие, технически точные ответы.
`.trim();

const AGENT_META = {
  SALES_AGENT:   { label: "Sales Agent",   color: "#1a5fb4", icon: "🚗", system: SYSTEM_SALES },
  SUPPORT_AGENT: { label: "Support Agent", color: "#2e7d32", icon: "📋", system: SYSTEM_SUPPORT },
  SERVICE_AGENT: { label: "Service Agent", color: "#6a1b9a", icon: "🔧", system: SYSTEM_SERVICE },
};

// ─── API CALL ─────────────────────────────────────────────────────────────────
async function callClaude(system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.map(b => b.text || "").join("");
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "10px 0" }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#94a3b8",
          animation: "bounce 1.2s infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

function AgentBadge({ agentKey }) {
  if (!agentKey) return null;
  const m = AGENT_META[agentKey];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: m.color + "18", border: `1px solid ${m.color}40`,
      borderRadius: 20, padding: "3px 10px", fontSize: 12, color: m.color, fontWeight: 600,
    }}>
      <span>{m.icon}</span> {m.label}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) {
    return (
      <div style={{ textAlign: "center", margin: "8px 0" }}>
        <span style={{
          display: "inline-block", background: "#f1f5f9",
          borderRadius: 20, padding: "4px 14px",
          fontSize: 12, color: "#64748b",
        }}>{msg.content}</span>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-end", gap: 8, marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: msg.agentColor || "#1a3c5e",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>
          {msg.agentIcon || "🤖"}
        </div>
      )}
      <div style={{
        maxWidth: "72%",
        background: isUser ? "#1a3c5e" : "#ffffff",
        color: isUser ? "#ffffff" : "#1e293b",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        padding: "10px 14px",
        fontSize: 14, lineHeight: 1.55,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        whiteSpace: "pre-wrap",
      }}>
        {!isUser && msg.agentLabel && (
          <div style={{ fontSize: 11, fontWeight: 700, color: msg.agentColor, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {msg.agentLabel}
          </div>
        )}
        {msg.content}
      </div>
      {isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>👤</div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function AutoNovaMVP() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [agentHistory, setAgentHistory] = useState([]);
  const [screen, setScreen] = useState("chat"); // "chat" | "kb"
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    // Initial greeting
    setMessages([{
      role: "assistant",
      agentLabel: "AutoNova",
      agentIcon: "🚘",
      agentColor: "#1a3c5e",
      content: "Добрый день! Я виртуальный ассистент AutoNova.\n\nЧем могу помочь?\n• Подбор и покупка автомобиля\n• Вопросы по заказу или документам\n• Сервис, гарантия, ТО",
    }]);
  }, []);

  const addSystemNote = (text) => {
    setMessages(prev => [...prev, { role: "system", content: text }]);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      let agent = currentAgent;

      // ── Orchestration: determine agent if not set ──
      if (!agent) {
        const orchResult = await callClaude(SYSTEM_ORCHESTRATOR, [{ role: "user", content: text }]);
        let parsed;
        try {
          parsed = JSON.parse(orchResult.trim());
        } catch {
          const match = orchResult.match(/\{[^}]+\}/s);
          parsed = match ? JSON.parse(match[0]) : { agent: "SUPPORT_AGENT", greeting: "Добро пожаловать!" };
        }
        agent = parsed.agent in AGENT_META ? parsed.agent : "SUPPORT_AGENT";
        setCurrentAgent(agent);
        setAgentHistory([]);
        const meta = AGENT_META[agent];
        addSystemNote(`Соединяю с ${meta.icon} ${meta.label}...`);
      }

      // ── Call specialist agent ──
      const meta = AGENT_META[agent];
      const history = [...agentHistory, { role: "user", content: text }];

      const reply = await callClaude(meta.system, history);

      setAgentHistory(prev => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: reply },
      ]);

      setMessages(prev => [...prev, {
        role: "assistant",
        agentLabel: meta.label,
        agentIcon: meta.icon,
        agentColor: meta.color,
        content: reply,
      }]);

    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        agentLabel: "Система",
        agentIcon: "⚠️",
        agentColor: "#c0392b",
        content: "Ошибка соединения. Попробуйте ещё раз.",
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const resetChat = () => {
    setCurrentAgent(null);
    setAgentHistory([]);
    setMessages([{
      role: "assistant",
      agentLabel: "AutoNova",
      agentIcon: "🚘",
      agentColor: "#1a3c5e",
      content: "Добрый день! Я виртуальный ассистент AutoNova.\n\nЧем могу помочь?\n• Подбор и покупка автомобиля\n• Вопросы по заказу или документам\n• Сервис, гарантия, ТО",
    }]);
  };

  const quickReplies = currentAgent ? [] : [
    "Хочу купить кроссовер",
    "Какие условия кредита?",
    "Статус заказа АН-2024-0512",
    "Вопрос по гарантии",
    "Записаться на ТО",
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        textarea:focus { outline: none; }
        button:hover { opacity: 0.88; }
        .msg-enter { animation: fadeIn 0.25s ease; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      `}</style>

      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        background: "#f8fafc", fontFamily: "'Inter', sans-serif",
      }}>

        {/* ── HEADER ── */}
        <div style={{
          background: "#1a3c5e",
          padding: "0 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 56, flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🚘</span>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>AutoNova</div>
              <div style={{ color: "#93c5fd", fontSize: 11 }}>Мультиагентный ИИ-ассистент</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {currentAgent && <AgentBadge agentKey={currentAgent} />}
            <button onClick={() => setScreen(s => s === "kb" ? "chat" : "kb")} style={{
              background: "#ffffff20", border: "none", color: "#fff",
              borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 500,
            }}>
              {screen === "kb" ? "← Чат" : "📚 База знаний"}
            </button>
            {currentAgent && (
              <button onClick={resetChat} style={{
                background: "#ffffff20", border: "none", color: "#fff",
                borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer",
              }}>↺ Новый чат</button>
            )}
          </div>
        </div>

        {screen === "kb" ? (
          /* ── KNOWLEDGE BASE VIEW ── */
          <div style={{ flex: 1, overflow: "auto", padding: 20, maxWidth: 800, margin: "0 auto", width: "100%" }}>
            <h2 style={{ color: "#1a3c5e", marginBottom: 16, fontSize: 18 }}>📚 База знаний AutoNova</h2>

            <Section title="🚗 Модели в наличии">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#1a3c5e", color: "#fff" }}>
                    {["Модель","Тип","Цена от","Комплектации"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {KB.models.map((m, i) => (
                    <tr key={m.name} style={{ background: i%2===0 ? "#f0f6ff" : "#fff" }}>
                      <td style={{ padding: "7px 12px", fontWeight: 600 }}>{m.name}</td>
                      <td style={{ padding: "7px 12px" }}>{m.type}</td>
                      <td style={{ padding: "7px 12px" }}>{m.price.toLocaleString("ru")} ₽</td>
                      <td style={{ padding: "7px 12px", color: "#64748b" }}>{m.configs.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="💳 Финансирование">
              <KBRow label="Кредит" value={`Первый взнос от ${KB.finance.credit.minDown}% · Срок до ${KB.finance.credit.maxTerm} мес. · От ${KB.finance.credit.rate}% годовых`} />
              <KBRow label="Лизинг B2B" value={`Первый взнос от ${KB.finance.leasing.minDown}% · Срок до ${KB.finance.leasing.maxTerm} мес. · От ${KB.finance.leasing.rate}% годовых`} />
            </Section>

            <Section title="🛡 Гарантия">
              <KBRow label="Заводская" value={KB.warranty.factory} />
              <KBRow label="Кузов" value={KB.warranty.body} />
              <KBRow label="ЛКП" value={KB.warranty.paint} />
            </Section>

            <Section title="🔧 Техническое обслуживание">
              <p style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>{KB.maintenance}</p>
              <KBRow label="ТО-1 (15 000 км)" value="Замена масла, воздушного и масляного фильтров" />
              <KBRow label="ТО-2 (30 000 км)" value="ТО-1 + замена тормозной жидкости" />
              <KBRow label="ТО-3 (45 000 км)" value="ТО-2 + диагностика тормозной системы" />
            </Section>

            <Section title="📦 Тестовые заказы">
              {Object.entries(KB.orders).map(([num, o]) => (
                <div key={num} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px", marginBottom: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3c5e" }}>{num}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{o.model} · {o.color}</div>
                  <div style={{ fontSize: 12, color: "#2e7d32", marginTop: 2 }}>Статус: {o.status} · Выдача: {o.eta}</div>
                </div>
              ))}
            </Section>
          </div>
        ) : (
          /* ── CHAT VIEW ── */
          <>
            <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 8px" }}>
              <div style={{ maxWidth: 680, margin: "0 auto" }}>
                {messages.map((msg, i) => (
                  <div key={i} className="msg-enter">
                    <Message msg={msg} />
                  </div>
                ))}
                {loading && (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: currentAgent ? AGENT_META[currentAgent].color : "#1a3c5e",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                    }}>
                      {currentAgent ? AGENT_META[currentAgent].icon : "🤖"}
                    </div>
                    <div style={{
                      background: "#fff", borderRadius: "18px 18px 18px 4px",
                      padding: "6px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}>
                      <TypingDots />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Quick replies */}
            {quickReplies.length > 0 && (
              <div style={{ padding: "0 16px 10px", maxWidth: 680, margin: "0 auto", width: "100%" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {quickReplies.map(q => (
                    <button key={q} onClick={() => { setInput(q); setTimeout(() => { setInput(""); sendMessageWith(q); }, 0); }}
                      style={{
                        background: "#fff", border: "1px solid #cbd5e1", borderRadius: 20,
                        padding: "5px 12px", fontSize: 12, color: "#475569", cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={e => e.target.style.borderColor = "#1a3c5e"}
                      onMouseLeave={e => e.target.style.borderColor = "#cbd5e1"}
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div style={{
              padding: "10px 16px 14px",
              background: "#fff",
              borderTop: "1px solid #e2e8f0",
              flexShrink: 0,
            }}>
              <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Напишите сообщение..."
                  rows={1}
                  style={{
                    flex: 1, resize: "none", border: "1px solid #e2e8f0",
                    borderRadius: 12, padding: "10px 14px", fontSize: 14,
                    fontFamily: "inherit", lineHeight: 1.5,
                    maxHeight: 120, overflow: "auto",
                    background: "#f8fafc", color: "#1e293b",
                  }}
                  onInput={e => {
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  style={{
                    width: 42, height: 42, borderRadius: "50%",
                    background: input.trim() && !loading ? "#1a3c5e" : "#94a3b8",
                    border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, transition: "background 0.2s",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                Учебный проект AutoNova · Все данные вымышлены · ИИ-ассистент
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  async function sendMessageWith(text) {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      let agent = currentAgent;
      if (!agent) {
        const orchResult = await callClaude(SYSTEM_ORCHESTRATOR, [{ role: "user", content: text }]);
        let parsed;
        try { parsed = JSON.parse(orchResult.trim()); }
        catch { parsed = { agent: "SUPPORT_AGENT" }; }
        agent = parsed.agent in AGENT_META ? parsed.agent : "SUPPORT_AGENT";
        setCurrentAgent(agent);
        setAgentHistory([]);
        const meta = AGENT_META[agent];
        addSystemNote(`Соединяю с ${meta.icon} ${meta.label}...`);
      }
      const meta = AGENT_META[agent];
      const history = [...agentHistory, { role: "user", content: text }];
      const reply = await callClaude(meta.system, history);
      setAgentHistory(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: reply }]);
      setMessages(prev => [...prev, {
        role: "assistant", agentLabel: meta.label,
        agentIcon: meta.icon, agentColor: meta.color, content: reply,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", agentLabel: "Система", agentIcon: "⚠️", agentColor: "#c0392b", content: "Ошибка. Попробуйте ещё раз." }]);
    } finally {
      setLoading(false);
    }
  }
}

function Section({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid #e2e8f0" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a3c5e", marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

function KBRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
      <span style={{ fontWeight: 600, color: "#475569", minWidth: 160, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#1e293b" }}>{value}</span>
    </div>
  );
}
