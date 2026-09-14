"use client";
import { useState } from "react";
import {
  Copy,
  History,
  ArrowRight,
  Check,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { seedProject, type Character, type Segment } from "@/lib/project";
import { useStudio } from "@/lib/store";
export function DebugPanel({
  block,
  role,
}: {
  block: Segment;
  role: Character;
}) {
  const update = useStudio((s) => s.updateSegment);
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const original = seedProject.chapters
    .flatMap((c) => c.segments)
    .find((s) => s.id === block.id);
  if (!original)
    return (
      <div className="trace-new">
        <History size={18} />
        <div>
          <strong>这个片段还没有生成记录</strong>
          <p>接入模型后，每版音频都会保留完整的输入、参数和输出快照。</p>
        </div>
      </div>
    );
  const originalRole = seedProject.characters.find(
    (c) => c.id === original.characterId,
  )!;
  const record = {
    id: `example-${block.id}-v1`,
    kind: "design-example",
    model: "Seed Audio 1.0（接入示例）",
    input: {
      text: original.text,
      character: originalRole.name,
      voice: originalRole.voice,
      emotion: original.emotion,
      speed: original.speed,
      pause: original.pause,
    },
    prompt: `${originalRole.name}，${originalRole.voice}。以${original.emotion}的语气表达：${original.text}`,
    references: [],
    output: {
      filename: `scene-${block.id}-v1.wav（示例）`,
      duration: original.duration,
    },
    note: "设计样例；未发起模型调用，没有实际生成文件。",
  };
  const changed =
    original.text !== block.text ||
    original.characterId !== block.characterId ||
    original.emotion !== block.emotion ||
    original.speed !== block.speed ||
    original.pause !== block.pause ||
    originalRole.voice !== role.voice ||
    original.model !== block.model;
  return (
    <div className="debug-panel">
      <div className="trace-heading">
        <div>
          <strong>
            v1 <span>输入与输出快照</span>
          </strong>
          <small>{record.id}</small>
        </div>
        <span className="prototype-tag">示例记录 · 非真实生成</span>
      </div>
      {changed && (
        <div className="trace-warning">
          <AlertCircle size={14} />{" "}
          当前文本或声音设置已改变，这份快照不会被覆盖。
        </div>
      )}
      <div className="trace-chain">
        <span>文本输入</span>
        <ArrowRight size={12} />
        <span>角色人声</span>
        <ArrowRight size={12} />
        <span>音频模型</span>
        <ArrowRight size={12} />
        <span>输出版本</span>
      </div>
      <div className="trace-info">
        <div>
          <small>模型</small>
          <strong>{record.model}</strong>
        </div>
        <div>
          <small>人声</small>
          <strong>
            {originalRole.name} · {original.emotion}
          </strong>
        </div>
        <div>
          <small>输出</small>
          <strong>WAV · {original.duration.toFixed(1)}s</strong>
        </div>
      </div>
      <label className="trace-prompt-label">当时的提示词</label>
      <p className="trace-prompt">{record.prompt}</p>
      {raw && (
        <pre className="trace-json">{JSON.stringify(record, null, 2)}</pre>
      )}
      <div className="trace-buttons">
        <button className="quiet" onClick={() => setRaw(!raw)}>
          {raw ? "收起" : "查看"}记录 JSON
        </button>
        <button
          className="quiet"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                JSON.stringify(record, null, 2),
              );
              setCopied(true);
            } catch {
              setRaw(true);
            }
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}{" "}
          {copied ? "已复制" : "复制记录"}
        </button>
        <button
          className="secondary small"
          onClick={() =>
            update(block.id, {
              text: original.text,
              characterId: original.characterId,
              emotion: original.emotion,
              speed: original.speed,
              pause: original.pause,
              duration: original.duration,
              model: original.model,
            })
          }
        >
          <RotateCcw size={12} />
          恢复本段文本与参数
        </button>
      </div>
    </div>
  );
}
