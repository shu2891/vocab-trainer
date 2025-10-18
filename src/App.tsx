import React, { useEffect, useMemo, useRef, useState } from "react";

/** Updated: auto-complete when only a word is given + Clear All button */

type Vocab = {
  id: string;
  word: string;
  pos?: string;
  zh?: string;
  synonym?: string;
  usage?: string;
  derivative?: string;
  example?: string;
  nextReview?: string;
  intervalDays?: number;
  ease?: number;
  history?: Array<{ date: string; rating: "easy" | "good" | "hard" }>;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString();
const addDays = (date: Date, days: number) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
const csvEscape = (v: string) => { if (v == null) return ""; const s = String(v); if (s.includes(",") || s.includes("\n") || s.includes("\"")) { return '"' + s.replace(/"/g, '""') + '"'; } return s; };
const tsvLine = (cols: string[]) => cols.join("\t");

function guessPOSBySuffix(word: string) {
  const w = word.toLowerCase();
  if (w.endsWith("ly")) return "adv.";
  if (w.endsWith("tion") || w.endsWith("sion") || w.endsWith("ment") || w.endsWith("ness")) return "n.";
  if (w.endsWith("ate") || w.endsWith("ize") || w.endsWith("ise") || w.endsWith("fy")) return "v.";
  if (w.endsWith("ous") || w.endsWith("ful") || w.endsWith("able") || w.endsWith("ible") || w.endsWith("ive") || w.endsWith("al")) return "adj.";
  return "";
}
function guessPOS(posRaw?: string) {
  if (!posRaw) return undefined;
  const p = posRaw.trim().toLowerCase();
  if (p.startsWith("v")) return "v.";
  if (p.startsWith("n")) return "n.";
  if (p.startsWith("adj")) return "adj.";
  if (p.startsWith("adv")) return "adv.";
  return posRaw;
}
function generateExample(word: string, pos?: string, zh?: string) {
  const w = (word || "").trim();
  const p = (pos || "").toLowerCase();
  if (!w) return "";
  if (p.startsWith("v")) return `I will ${w} it tomorrow.`;
  if (p.startsWith("n")) return `The ${w} plays an important role in our lives.`;
  if (p.startsWith("adj")) return `This is an ${w} issue we must address.`;
  if (p.startsWith("adv")) return `She spoke ${w} to make her point clear.`;
  return `We need to ${w} — ${zh || ""}`.trim();
}
function speak(text: string, lang = "en-US") {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

const SAMPLE_TSV = `accumulate\tv.\t累積、堆積\tcollect\taccumulate for 為...堆積\taccumulation
acknowledge\tv.\t承認、答謝、報償\tadmit\tacknowledge to 承認或認可某人/物的重要性\tacknowledgement
acquaint\tv.\t使了解、使認識、使熟悉\taccustom\tacquaint sb. with 使某人知道某事\tknow`;

function parseText(text: string): Vocab[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows: Vocab[] = [];
  for (const line of lines) {
    const cols = line.split(/\t+|\s{2,}/g);
    if (cols.length === 1) {
      const word = cols[0].trim();
      if (!word) continue;
      const guessed = guessPOSBySuffix(word);
      rows.push({
        id: uid(),
        word,
        pos: guessed || undefined,
        zh: "(待補)",
        synonym: "",
        usage: "",
        derivative: "",
        example: generateExample(word, guessed, "(待補)"),
        intervalDays: 0,
        ease: 200,
        nextReview: todayISO(),
        history: [],
      });
      continue;
    }
    const [word = "", posRaw = "", zh = "", synonym = "", usage = "", derivative = "", example = ""] = cols;
    const pos = guessPOS(posRaw) || guessPOSBySuffix(word);
    rows.push({
      id: uid(),
      word: word.trim(),
      pos: pos || undefined,
      zh: zh || undefined,
      synonym: synonym || undefined,
      usage: usage || undefined,
      derivative: derivative || undefined,
      example: (example && example.trim()) ? example : generateExample(word, pos, zh),
      intervalDays: 0,
      ease: 200,
      nextReview: todayISO(),
      history: [],
    });
  }
  return rows;
}

const LS_KEY = "vocab-trainer-words";
function useLocalStorageState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; }
    catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState] as const;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-block rounded-full border px-2 py-0.5 text-xs text-gray-700">{children}</span>;
}
function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      <div className="rounded-2xl border p-4 shadow-sm">{children}</div>
    </section>
  );
}

function Importer({ onImport }: { onImport: (items: Vocab[]) => void }) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = async (f: File) => { const t = await f.text(); onImport(parseText(t)); };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className="rounded-xl border px-3 py-2 shadow-sm hover:bg-gray-50" onClick={() => onImport(parseText(SAMPLE_TSV))}>載入示例（你的 20 字）</button>
        <button className="rounded-xl border px-3 py-2 shadow-sm hover:bg-gray-50" onClick={() => fileRef.current?.click()}>上傳 CSV/TSV</button>
        <input type="file" accept=".csv,.tsv,.txt" ref={fileRef} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f);} }/>
      </div>
      <textarea className="h-32 w-full rounded-xl border p-3 focus:outline-none" placeholder={"或直接貼上：\nword\tpos\t中文\t同義詞\t用法/片語\t衍生字\t例句\n(也支援只貼英文單字，每行一個)"} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center gap-2">
        <button className="rounded-xl border px-4 py-2 shadow-sm hover:bg-gray-50" onClick={() => { if (!text.trim()) return; onImport(parseText(text)); setText("");}}>解析貼上的單字</button>
        <span className="text-sm text-gray-500">支援 TSV（建議）、或每行一個單字</span>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, textarea }: { label: string; value?: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-600">{label}</span>
      {textarea ? <textarea className="rounded-xl border p-2" value={value || ""} onChange={(e) => onChange(e.target.value)} />
                : <input className="rounded-xl border p-2" value={value || ""} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function WordCard({ v, onUpdate, onRemove }: { v: Vocab; onUpdate: (nv: Vocab) => void; onRemove: () => void }) {
  const due = v.nextReview ? new Date(v.nextReview) : null;
  const isDue = !due || due <= new Date();
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${isDue ? "" : "opacity-60"}`}>
      <div className="mb-2 flex items-start justify-between">
        <div className="space-x-2">
          <span className="text-xl font-semibold">{v.word}</span>
          {v.pos && <Badge>{v.pos}</Badge>}
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50" onClick={() => speak(v.word)}>🔊</button>
          <button className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50" onClick={onRemove}>刪除</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="中文意思" value={v.zh} onChange={(val) => onUpdate({ ...v, zh: val })} />
        <Field label="同義詞" value={v.synonym} onChange={(val) => onUpdate({ ...v, synonym: val })} />
        <Field label="常見用法/片語" value={v.usage} onChange={(val) => onUpdate({ ...v, usage: val })} />
        <Field label="衍生字" value={v.derivative} onChange={(val) => onUpdate({ ...v, derivative: val })} />
        <Field label="例句" value={v.example} onChange={(val) => onUpdate({ ...v, example: val })} textarea />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span>複習：{due ? new Date(due).toLocaleDateString() : "今天"}</span>
        <span>| 間隔：{v.intervalDays ?? 0}天</span>
        <span>| 進度：{v.history?.length ?? 0} 次</span>
      </div>
    </div>
  );
}

function Stepper5({ current, onChange }: { current: number; onChange: (i: number) => void }) {
  const steps = ["理解", "聯想", "應用", "測驗", "重複"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <button key={s} className={`rounded-full border px-3 py-1 text-sm ${i === current ? "bg-black text-white" : "hover:bg-gray-50"}`} onClick={() => onChange(i)}>
          {i + 1}. {s}
        </button>
      ))}
    </div>
  );
}

function Quiz({ pool, onResult }: { pool: Vocab[]; onResult: (correct: number, total: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState(0);
  const [mode, setMode] = useState<"en2zh" | "zh2en" | "blank">("en2zh");
  const q = pool[idx]; const total = pool.length;
  useEffect(() => { if (idx >= total) onResult(correct, total); }, [idx]);
  if (!q) return <div className="text-sm text-gray-500">沒有待測驗的單字</div>;

  const prompt = mode === "en2zh" ? q.word : mode === "zh2en" ? (q.zh || "") : (q.example || "").replace(new RegExp(`\\b${q.word}\\b`, "i"), "_____");
  const placeholder = mode === "en2zh" ? "輸入中文" : mode === "zh2en" ? "輸入英文" : "填空英文單字";
  const check = () => {
    let ok = false;
    if (mode === "en2zh") ok = (q.zh || "").includes(answer.trim());
    else if (mode === "zh2en") ok = q.word.toLowerCase() == answer.trim().toLowerCase();
    else ok = q.word.toLowerCase() == answer.trim().toLowerCase();
    setCorrect((c) => c + (ok ? 1 : 0)); setIdx((i) => i + 1); setAnswer("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-1"><input type="radio" checked={mode === "en2zh"} onChange={() => setMode("en2zh")} /> 英→中</label>
        <label className="flex items-center gap-1"><input type="radio" checked={mode === "zh2en"} onChange={() => setMode("zh2en")} /> 中→英</label>
        <label className="flex items-center gap-1"><input type="radio" checked={mode === "blank"} onChange={() => setMode("blank")} /> 填空</label>
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-3 text-sm text-gray-500">第 {idx + 1} / {total} 題</div>
        <div className="mb-2 text-2xl font-semibold">{prompt}</div>
        <input className="w-full rounded-xl border p-2" value={answer} placeholder={placeholder} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && check()} />
        <div className="mt-3 flex gap-2">
          <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={check}>送出</button>
          <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => speak(q.word)}>🔊 朗讀</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useLocalStorageState<Vocab[]>(LS_KEY, []);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter((v) =>
      [v.word, v.pos, v.zh, v.synonym, v.usage, v.derivative].some((x) => (x || "").toLowerCase().includes(s))
    );
  }, [items, search]);

  const duePool = useMemo(() => {
    const now = new Date();
    return items.filter((v) => !v.nextReview || new Date(v.nextReview) <= now);
  }, [items]);

  function importItems(vs: Vocab[]) {
    const map = new Map<string, Vocab>();
    [...items, ...vs].forEach((v) => {
      const key = `${v.word.toLowerCase()}|${v.pos || ""}`;
      const existing = map.get(key);
      map.set(key, { ...(existing || {} as Vocab), ...v, id: existing?.id || v.id });
    });
    setItems([...map.values()]);
  }
  function updateItem(id: string, nv: Vocab) { setItems((arr) => arr.map((x) => (x.id === id ? nv : x))); }
  function removeItem(id: string) { setItems((arr) => arr.filter((x) => x.id !== id)); }

  function schedule(v: Vocab, rating: "easy" | "good" | "hard") {
    const ease = Math.max(130, Math.min(250, (v.ease || 200) + (rating === "easy" ? 20 : rating === "hard" ? -20 : 0)));
    const last = v.intervalDays || 0;
    const factor = rating === "easy" ? 2.5 : rating === "good" ? 2 : 1.3;
    const next = Math.max(1, Math.round((last || 1) * (ease / 200) * factor));
    const nextDate = addDays(new Date(), next);
    updateItem(v.id, { ...v, ease, intervalDays: next, nextReview: nextDate.toISOString(), history: [...(v.history || []), { date: todayISO(), rating }] });
  }

  function exportCSV() {
    const header = ["word", "pos", "zh", "synonym", "usage", "derivative", "example"];
    const lines = [header.join(",")].concat(
      items.map((v) => [v.word, v.pos || "", v.zh || "", v.synonym || "", v.usage || "", v.derivative || "", v.example || ""].map(csvEscape).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `vocab_${new Date().toISOString().slice(0, 10)}.csv`);
  }
  function exportAnkiTSV() {
    const lines = items.map((v) => tsvLine([v.word, `${v.pos || ""} ${v.zh || ""}<br/><i>${v.example || ""}</i>`]));
    const blob = new Blob([lines.join("\n")], { type: "text/tab-separated-values;charset=utf-8;" });
    downloadBlob(blob, `vocab_anki_${new Date().toISOString().slice(0, 10)}.tsv`);
  }
  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  function clearAll() {
    if (confirm("確定要刪除所有單字與進度嗎？這個動作無法復原！")) {
      localStorage.removeItem(LS_KEY); setItems([]);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vocabulary Trainer – 5步強化記憶</h1>
          <p className="text-sm text-gray-500">匯入單字（支援只輸入英文）→ 產出欄位 → 測驗與複習</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="rounded-xl border px-3 py-2 shadow-sm hover:bg-gray-50" onClick={exportCSV}>匯出 CSV</button>
          <button className="rounded-xl border px-3 py-2 shadow-sm hover:bg-gray-50" onClick={exportAnkiTSV}>匯出 Anki TSV</button>
          <button className="rounded-xl border px-3 py-2 shadow-sm hover:bg-red-50 text-red-600" onClick={clearAll}>🗑 一鍵清除全部</button>
        </div>
      </header>

      <Section title="1) 匯入與建立欄位" right={<Badge>支援：CSV / TSV / 每行單字</Badge>}>
        <Importer onImport={importItems} />
        {!!items.length && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <input className="w-full rounded-xl border p-2 md:w-80" placeholder="搜尋：英文 / 中文 / 同義詞 / 片語" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Badge>目前 {items.length} 個單字</Badge>
          </div>
        )}
      </Section>

      {!!items.length && (
        <>
          <Section title="2) 5步強化記憶流程" right={<Stepper5 current={step} onChange={setStep} />}>
            <div className="grid gap-4 md:grid-cols-5">
              <div className={`rounded-2xl border p-4 ${step === 0 ? "bg-gray-50" : "opacity-70"}`}>
                <h3 className="mb-2 font-semibold">① 理解</h3>
                <p className="text-sm text-gray-600">先看中文意思、同義詞與例句，將抽象字轉成具體畫面。</p>
              </div>
              <div className={`rounded-2xl border p-4 ${step === 1 ? "bg-gray-50" : "opacity-70"}`}>
                <h3 className="mb-2 font-semibold">② 聯想</h3>
                <p className="text-sm text-gray-600">建立圖像/情境或中文諧音記憶點，在「例句」或備註中寫下。</p>
              </div>
              <div className={`rounded-2xl border p-4 ${step === 2 ? "bg-gray-50" : "opacity-70"}`}>
                <h3 className="mb-2 font-semibold">③ 應用</h3>
                <p className="text-sm text-gray-600">自己造 1 句生活化例句，或按 🔊 進行跟讀。</p>
              </div>
              <div className={`rounded-2xl border p-4 ${step === 3 ? "bg-gray-50" : "opacity-70"}`}>
                <h3 className="mb-2 font-semibold">④ 測驗</h3>
                <p className="text-sm text-gray-600">使用下方測驗區（英→中／中→英／填空）找出弱點。</p>
              </div>
              <div className={`rounded-2xl border p-4 ${step === 4 ? "bg-gray-50" : "opacity-70"}`}>
                <h3 className="mb-2 font-semibold">⑤ 重複</h3>
                <p className="text-sm text-gray-600">根據簡易間隔：<b>1天 → 3天 → 7天</b> 複習，標記難度自動安排。</p>
              </div>
            </div>
          </Section>

          <Section title="3) 今日到期複習與測驗">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge>到期：{duePool.length} / {items.length}</Badge>
              <button className="rounded-xl border px-3 py-2 shadow-sm hover:bg-gray-50" onClick={() => setStep(3)}>開始測驗</button>
            </div>
            {step === 3 ? (
              <Quiz pool={duePool.length ? duePool : items} onResult={(correct, total) => alert(`完成！得分 ${correct}/${total}`)} />
            ) : (
              <div className="text-sm text-gray-500">切換到「④ 測驗」步驟以開始。</div>
            )}
          </Section>

          <Section title="4) 單字清單與編輯" right={<span className="text-sm text-gray-500">點 🔊 可朗讀</span>}>
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((v) => (
                <div key={v.id} className="space-y-3">
                  <WordCard v={v} onUpdate={(nv) => updateItem(v.id, nv)} onRemove={() => removeItem(v.id)} />
                  <div className="-mt-2 mb-2 flex flex-wrap gap-2">
                    <button className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50" onClick={() => schedule(v, "easy")}>標記：容易</button>
                    <button className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50" onClick={() => schedule(v, "good")}>標記：一般</button>
                    <button className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50" onClick={() => schedule(v, "hard")}>標記：困難</button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {!items.length && (
        <div className="rounded-2xl border p-6 text-center text-gray-500">
          還沒有單字。先在上方「匯入與建立欄位」貼上或上傳，或試試「載入示例」。
        </div>
      )}

      <footer className="mt-10 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Vocabulary Trainer • 本地儲存，不上傳資料。
      </footer>
    </div>
  );
}
