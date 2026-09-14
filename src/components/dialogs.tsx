"use client";
import { useState, useRef } from "react";
import {
  Upload,
  ArrowRight,
  Check,
  BookOpen,
  UsersRound,
  AlignLeft,
  Sparkles,
} from "lucide-react";
import {
  planImport,
  proposeEdit,
  type Project,
  type Proposal,
  type Format,
} from "@/lib/project";
import { useStudio } from "@/lib/store";
import { Modal } from "./ui";
export function ImportDialog({
  close,
  notify,
}: {
  close: () => void;
  notify: (s: string) => void;
}) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("新作品");
  const [format, setFormat] = useState<Format>("有声小说");
  const [plan, setPlan] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const replace = useStudio((s) => s.replaceProject);
  return (
    <Modal title="把文字带进 TaleWeft" close={close} wide>
      <div className="import-content">
        <div className="import-heading">
          <span className="eyebrow">从一段文字，到一部声音作品</span>
          <p>
            粘贴正文，或上传 TXT / Markdown。先预览拆分结果，再进入章节编辑器。
          </p>
        </div>
        <div className="import-meta">
          <label>
            作品名称
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            内容类型
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
            >
              <option>有声小说</option>
              <option>有声剧</option>
              <option>广播剧</option>
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={15} />
            上传文本
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 400_000) {
                setError("文件过大，原型支持 400 KB 以内的文本文件。");
                return;
              }
              setText(await file.text());
              setTitle(file.name.replace(/\.[^.]+$/, ""));
              setPlan(null);
            }}
          />
        </div>
        <textarea
          className="import-text"
          aria-label="待导入的长文本"
          placeholder={
            "第一章 雨夜\n\n林夏：有人吗？我来取一封信。\n顾言：你比我想象中，来得更晚。\n\n也可以直接粘贴没有角色标记的小说正文。"
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPlan(null);
            setError("");
          }}
        />
        <div className="import-detail">
          <span>{text.length.toLocaleString()} / 100,000 字符</span>
          <span>本地规则拆分演示 · 无模型调用</span>
        </div>
        {plan && (
          <div className="import-plan">
            <h3>拆分预览</h3>
            <div>
              <span>
                <BookOpen size={15} />
                {plan.chapters.length} 章
              </span>
              <span>
                <UsersRound size={15} />
                {plan.characters.length} 个角色
              </span>
              <span>
                <AlignLeft size={15} />
                {plan.chapters.reduce((n, c) => n + c.segments.length, 0)}{" "}
                个片段
              </span>
            </div>
            <ol>
              {plan.chapters.slice(0, 8).map((c) => (
                <li key={c.id}>
                  {c.title}
                  <small>{c.segments.length} 个片段</small>
                </li>
              ))}
            </ol>
            <p>
              章节按标题识别；角色按“姓名：台词”识别，其余归入旁白。当前作品将被替换，可撤销恢复。
            </p>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button
            className="quiet"
            onClick={() => {
              setText(
                "第一章 雨夜\n雨落在旧城区的屋檐上。\n林夏：有人吗？我来取一封信。\n顾言：你比我想象中，来得更晚。\n\n第二章 来信\n信封没有邮戳。\n林夏：这封信是谁写的？",
              );
              setPlan(null);
            }}
          >
            填入演示文本
          </button>
          {plan ? (
            <button
              className="primary"
              onClick={() => {
                replace(plan);
                notify("已创建章节与角色，可以直接编辑；支持撤销");
                close();
              }}
            >
              <Check size={15} />
              应用拆分并开始编辑
            </button>
          ) : (
            <button
              className="primary"
              onClick={() => {
                try {
                  setPlan(planImport(text, title, format));
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              预览拆分
              <ArrowRight size={15} />
            </button>
          )}
        </footer>
      </div>
    </Modal>
  );
}
export function LocalEditDialog({
  close,
  notify,
}: {
  close: () => void;
  notify: (s: string) => void;
}) {
  const { project, chapterId, selectedId, revision, applyProposal } =
    useStudio();
  const block = project.chapters
    .flatMap((c) => c.segments)
    .find((s) => s.id === selectedId)!;
  const [input, setInput] = useState("改为低声，停顿 0.6 秒");
  const [scope, setScope] = useState<"selection" | "chapter">("selection");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState("");
  return (
    <Modal title="局部修改" close={close}>
      <div className="local-edit">
        <div className="context-pill">
          <AlignLeft size={13} /> 当前片段 · {block.text.slice(0, 18)}…
        </div>
        <div className="scope-choice">
          <button
            className={scope === "selection" ? "active" : ""}
            onClick={() => {
              setScope("selection");
              setProposal(null);
            }}
          >
            当前片段
          </button>
          <button
            className={scope === "chapter" ? "active" : ""}
            onClick={() => {
              setScope("chapter");
              setProposal(null);
            }}
          >
            整章
          </button>
        </div>
        <label>
          描述你想调整的表达
          <textarea
            autoFocus
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setProposal(null);
            }}
          />
        </label>
        <div className="quick-instructions">
          {["改为紧张，停顿 0.8 秒", "放慢到 0.85 倍", "改为温柔"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setInput(t);
                setProposal(null);
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="demo-disclaimer">
          本地交互演示：支持情绪、语速和停顿指令。尚未连接
          Agent，自由改写将在后续提供。
        </p>
        {proposal && (
          <div className="proposal">
            <strong>将修改 {proposal.patches.length} 个片段</strong>
            <p>正文不改动，只更新声音表达参数。</p>
            {Object.entries(proposal.patches[0]?.changes ?? {}).map(
              ([key, value]) => (
                <div key={key}>
                  <span>
                    {{ emotion: "情绪", speed: "语速", pause: "停顿" }[key] ??
                      key}
                  </span>
                  <b>
                    {String(value)}
                    {key === "pause" ? " s" : key === "speed" ? "×" : ""}
                  </b>
                </div>
              ),
            )}
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <span>变更可预览、可撤销</span>
          {proposal ? (
            <button
              className="primary"
              onClick={() => {
                try {
                  applyProposal(proposal);
                  notify("已应用局部修改，可在顶部撤销");
                  close();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Check size={14} />
              应用修改
            </button>
          ) : (
            <button
              className="primary"
              onClick={() => {
                try {
                  setProposal(
                    proposeEdit(
                      project,
                      chapterId,
                      selectedId,
                      scope,
                      input,
                      revision,
                    ),
                  );
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Sparkles size={14} />
              预览修改
            </button>
          )}
        </footer>
      </div>
    </Modal>
  );
}
