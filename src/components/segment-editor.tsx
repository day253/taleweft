"use client";
import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ChevronDown,
  SlidersHorizontal,
  Play,
  Link2,
  Sparkles,
  Music2,
  CloudRain,
  History,
  FileDiff,
  ArrowUp,
  ArrowDown,
  CornerDownRight,
  X,
} from "lucide-react";
import { useStudio } from "@/lib/store";
import {
  segmentTimings,
  timeLabel,
  estimateDuration,
  cueStart,
  cueDuration,
  type Chapter,
  type Segment,
} from "@/lib/project";
import { TextCompare } from "./text-compare";
import { DebugPanel } from "./trace-panel";

export function SegmentEditor({
  block,
  chapter,
  index,
  reading,
  activeCue,
  selectCue,
  preview,
  openLocal,
}: {
  block: Segment;
  chapter: Chapter;
  index: number;
  reading: boolean;
  activeCue: string | null;
  selectCue: (id: string) => void;
  preview: (s: Segment) => void;
  openLocal: () => void;
}) {
  const {
    project,
    selectedId,
    expandedId,
    select,
    expand,
    updateSegment,
    mutate,
  } = useStudio();
  const [tab, setTab] = useState<"settings" | "debug" | "text">("settings");
  const role =
    project.characters.find((c) => c.id === block.characterId) ??
    project.characters[0];
  const selected = selectedId === block.id;
  const expanded = expandedId === block.id && !reading;
  const timing = segmentTimings(chapter)[index];
  const music = chapter.cues.find(
    (c) =>
      c.kind === "music" &&
      cueStart(chapter, c) < timing.end &&
      cueStart(chapter, c) + cueDuration(chapter, c) > timing.start,
  );
  const firstMusic =
    music &&
    !segmentTimings(chapter)
      .slice(0, index)
      .some(
        (t) =>
          cueStart(chapter, music) < t.end &&
          cueStart(chapter, music) + cueDuration(chapter, music) > t.start,
      );
  const lastMusic =
    music &&
    !segmentTimings(chapter)
      .slice(index + 1)
      .some(
        (t) =>
          cueStart(chapter, music) < t.end &&
          cueStart(chapter, music) + cueDuration(chapter, music) > t.start,
      );
  const cues = chapter.cues.filter(
    (c) =>
      c.kind !== "music" &&
      (c.anchorId === block.id ||
        (!c.anchorId && c.start >= timing.start && c.start < timing.next)),
  );
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        horizontalRule: false,
      }),
    ],
    immediatelyRender: false,
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: block.text ? [{ type: "text", text: block.text }] : [],
        },
      ],
    },
    editorProps: {
      attributes: {
        "aria-label": `编辑片段 ${index + 1} 正文`,
        class: "novel-text",
      },
    },
    onFocus: () => select(block.id),
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      updateSegment(block.id, { text, duration: estimateDuration(text) });
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      select(block.id, editor.state.doc.textBetween(from, to, " "));
    },
  });
  useEffect(() => {
    if (editor && editor.getText() !== block.text)
      editor.commands.setContent(
        {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: block.text ? [{ type: "text", text: block.text }] : [],
            },
          ],
        },
        { emitUpdate: false },
      );
  }, [block.text, editor]);
  function reorder(direction: number) {
    mutate("调整段落顺序", (p) => {
      const c = p.chapters.find((c) => c.id === chapter.id)!;
      const i = c.segments.findIndex((s) => s.id === block.id);
      const target = i + direction;
      if (target < 0 || target >= c.segments.length) return;
      [c.segments[i], c.segments[target]] = [c.segments[target], c.segments[i]];
    });
  }
  return (
    <section
      id={`segment-${block.id}`}
      className={`segment ${selected ? "selected" : ""} ${expanded ? "is-expanded" : ""} ${music ? "music-covered" : ""} ${firstMusic ? "music-first" : ""} ${lastMusic ? "music-last" : ""}`}
      data-segment={block.id}
      onClick={() => {
        if (!selected) select(block.id);
      }}
    >
      {firstMusic && (
        <button
          className={`music-range-label ${activeCue === music!.id ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            selectCue(music!.id);
          }}
        >
          <Music2 size={13} />
          <strong>{music!.name}</strong>
          <span>覆盖下方段落 · {music!.gain} dB</span>
          <SlidersHorizontal size={12} />
        </button>
      )}
      <div className="segment-main">
        <div className="segment-top">
          <div className="segment-identity">
            <span className="line-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={`role-pill ${role.color}`}>
              <select
                aria-label={`片段${index + 1}角色`}
                value={block.characterId}
                onChange={(e) =>
                  updateSegment(block.id, { characterId: e.target.value })
                }
              >
                {project.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} />
            </span>
            <span className="tone-label">{block.emotion}</span>
            {!reading &&
              block.original &&
              block.text !== block.original.text && (
                <button
                  className="text-change-badge"
                  onClick={() => {
                    setTab("text");
                    expand(block.id);
                  }}
                >
                  正文有修改 · 对照
                </button>
              )}
            {block.status === "stale" && (
              <span
                className="changed-dot"
                title="设置已改动，生成记录仍保留原值"
              >
                已修改
              </span>
            )}
          </div>
          <div className="segment-actions">
            <span className="timecode">{timeLabel(timing.start)}</span>
            {!reading && (
              <>
                <button
                  title="上移片段"
                  disabled={index === 0}
                  onClick={() => reorder(-1)}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  title="下移片段"
                  disabled={index === chapter.segments.length - 1}
                  onClick={() => reorder(1)}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  aria-label={`展开片段${index + 1}设置`}
                  className={expanded ? "active" : ""}
                  onClick={() => expand(expanded ? null : block.id)}
                >
                  <SlidersHorizontal size={14} />
                </button>
              </>
            )}
          </div>
        </div>
        <EditorContent editor={editor} />
        {cues.length > 0 && (
          <div className="inline-cues">
            {cues.map((c) => (
              <button
                className={`inline-cue ${c.kind} ${activeCue === c.id ? "active" : ""}`}
                key={c.id}
                onClick={(e) => {
                  e.stopPropagation();
                  selectCue(c.id);
                }}
              >
                {c.kind === "sfx" ? (
                  <Sparkles size={12} />
                ) : (
                  <CloudRain size={12} />
                )}
                <strong>{c.name}</strong>
                <span>
                  {c.anchorId ? <Link2 size={10} /> : null}
                  {c.gain} dB
                </span>
              </button>
            ))}
          </div>
        )}
        {!reading && selected && !expanded && (
          <div className="selection-toolbar">
            <button onClick={() => expand(block.id)}>
              <SlidersHorizontal size={12} /> 片段设置
            </button>
            <button
              onClick={() => {
                setTab("debug");
                expand(block.id);
              }}
            >
              <History size={12} /> 生成记录
            </button>
            <button
              onClick={() => {
                setTab("text");
                expand(block.id);
              }}
            >
              <FileDiff size={12} />
              原文对照
            </button>
            <button onClick={openLocal}>
              <Sparkles size={12} /> 局部修改
            </button>
            <button onClick={() => preview(block)}>
              <Play size={12} /> 朗读这段
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="inline-inspector">
          <div className="inspector-tabs">
            <button
              className={tab === "settings" ? "active" : ""}
              onClick={() => setTab("settings")}
            >
              <SlidersHorizontal size={13} />
              片段设置
            </button>
            <button
              className={tab === "debug" ? "active" : ""}
              onClick={() => setTab("debug")}
            >
              <History size={13} />
              生成记录 <span>Debug</span>
            </button>
            <button
              className={tab === "text" ? "active" : ""}
              onClick={() => setTab("text")}
            >
              <FileDiff size={13} />
              原文对照
            </button>
            <button
              className="close-inspector"
              aria-label="收起片段设置"
              onClick={() => expand(null)}
            >
              <X size={13} />
            </button>
          </div>
          {tab === "settings" ? (
            <>
              <div className="parameter-grid">
                <label>
                  表演情绪
                  <select
                    value={block.emotion}
                    onChange={(e) =>
                      updateSegment(block.id, { emotion: e.target.value })
                    }
                  >
                    {[
                      "自然",
                      "低声",
                      "平静",
                      "警觉",
                      "疑惑",
                      "沉稳",
                      "悬疑",
                      "温柔",
                      "紧张",
                      "急促",
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  片段语速 <b>{block.speed.toFixed(2)}×</b>
                  <input
                    aria-label={`片段${index + 1}语速`}
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={block.speed}
                    onChange={(e) =>
                      updateSegment(block.id, { speed: +e.target.value })
                    }
                  />
                </label>
                <label>
                  句后停顿 <b>{block.pause.toFixed(1)} s</b>
                  <input
                    aria-label={`片段${index + 1}停顿`}
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={block.pause}
                    onChange={(e) =>
                      updateSegment(block.id, { pause: +e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="parameter-footer">
                <span>
                  <CornerDownRight size={13} /> 仅修改本段，角色默认设置不变
                </span>
                <button className="quiet" onClick={openLocal}>
                  <Sparkles size={13} /> 局部指令
                </button>
                <button
                  className="secondary small"
                  onClick={() => preview(block)}
                >
                  <Play size={12} /> 朗读这段
                </button>
              </div>
            </>
          ) : tab === "text" ? (
            <TextCompare block={block} />
          ) : (
            <DebugPanel block={block} role={role} />
          )}
        </div>
      )}
    </section>
  );
}
