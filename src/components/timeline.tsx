"use client";
import { useRef, useState } from "react";
import {
  AudioLines,
  Sparkles,
  Music2,
  CloudRain,
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  Link2,
  Magnet,
  ChevronDown,
  X,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useStudio } from "@/lib/store";
import {
  chapterDuration,
  cueStart,
  cueDuration,
  segmentTimings,
  timeLabel,
  uid,
  type Chapter,
  type Cue,
} from "@/lib/project";
import { Wave, IconButton } from "./ui";

export function Timeline({
  chapter,
  playing,
  playhead,
  onPlay,
  onSeek,
  activeCue,
  selectCue,
  notify,
}: {
  chapter: Chapter;
  playing: boolean;
  playhead: number;
  onPlay: () => void;
  onSeek: (n: number) => void;
  activeCue: string | null;
  selectCue: (id: string | null) => void;
  notify: (s: string) => void;
}) {
  const { project, selectedId, select, updateCue, mutate } = useStudio();
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [muted, setMuted] = useState<string[]>([]);
  const [drag, setDrag] = useState<{
    id: string;
    start: number;
    duration: number;
  } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const timings = segmentTimings(chapter);
  const duration = chapterDuration(chapter);
  const scaleDuration = Math.max(60, Math.ceil(duration / 10) * 10);
  const selectedCue = chapter.cues.find((c) => c.id === activeCue);
  const tracks = [
    { kind: "voice", label: "人声", icon: AudioLines },
    { kind: "sfx", label: "音效", icon: Sparkles },
    { kind: "music", label: "配乐", icon: Music2 },
    { kind: "ambience", label: "环境", icon: CloudRain },
  ];
  function moveCue(e: React.PointerEvent, cue: Cue, resize = false) {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectCue(cue.id);
    const width = trackRef.current!.getBoundingClientRect().width;
    const initialX = e.clientX;
    const initialStart = cueStart(chapter, cue);
    const initialDuration = cueDuration(chapter, cue);
    let nextStart = initialStart;
    let nextDuration = initialDuration;
    let nearest: string | null = null;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - initialX) < 2 && !moved) return;
      moved = true;
      const delta = ((ev.clientX - initialX) / width) * scaleDuration;
      if (resize) {
        nextDuration = Math.max(
          0.5,
          Math.min(scaleDuration - nextStart, initialDuration + delta),
        );
      } else {
        nextStart = Math.max(
          0,
          Math.min(
            scaleDuration - cueDuration(chapter, cue),
            initialStart + delta,
          ),
        );
        nearest = null;
        if (snap) {
          const target = timings.find(
            (t) => Math.abs(t.start - nextStart) < 0.65,
          );
          if (target) {
            nextStart = target.start;
            nearest = target.id;
          }
        }
      }
      setDrag({ id: cue.id, start: nextStart, duration: nextDuration });
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      setDrag(null);
      if (!moved) return;
      if (resize) {
        updateCue(cue.id, {
          duration: Math.round(nextDuration * 10) / 10,
          endAnchorId: undefined,
        });
      } else {
        updateCue(cue.id, {
          anchorId: nearest,
          start: Math.round((nearest ? 0 : nextStart) * 10) / 10,
          duration: initialDuration,
          endAnchorId: undefined,
        });
        if (nearest) notify("已吸附并绑定到对应正文片段");
      }
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
  }
  function drop(e: React.DragEvent, kind: string) {
    e.preventDefault();
    let data: { name: string; kind: Cue["kind"]; duration: number };
    try {
      data = JSON.parse(e.dataTransfer.getData("application/taleweft-asset"));
    } catch {
      return;
    }
    if (!["sfx", "music", "ambience"].includes(data.kind)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let start = ((e.clientX - rect.left) / rect.width) * scaleDuration;
    start = Math.max(0, start);
    const anchor = snap
      ? timings.find((t) => Math.abs(t.start - start) < 0.65)
      : undefined;
    const cue: Cue = {
      id: uid("cue"),
      name: data.name,
      kind: data.kind,
      start: anchor ? 0 : Math.round(start * 10) / 10,
      anchorId: anchor?.id ?? null,
      duration: data.duration,
      gain: data.kind === "sfx" ? -8 : -20,
    };
    mutate("拖入声音素材", (p) =>
      p.chapters.find((c) => c.id === chapter.id)!.cues.push(cue),
    );
    selectCue(cue.id);
  }
  return (
    <section
      className={`timeline ${collapsed ? "collapsed" : ""}`}
      aria-label="章节音轨播放器"
    >
      <div className="transport">
        <div className="transport-title">
          <button className="quiet" onClick={() => setCollapsed(!collapsed)}>
            <ChevronDown
              size={15}
              style={{ transform: collapsed ? "rotate(180deg)" : undefined }}
            />
          </button>
          <strong>章节音轨</strong>
          <span>估算时轴</span>
        </div>
        <div className="play-controls">
          <IconButton label="回到开头" onClick={() => onSeek(0)}>
            <SkipBack size={17} />
          </IconButton>
          <button
            className="play-button"
            aria-label={playing ? "暂停播放" : "播放章节预览"}
            onClick={onPlay}
          >
            {playing ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>
          <span className="play-time">
            {timeLabel(playhead)} <i>/ {timeLabel(duration)}</i>
          </span>
        </div>
        <div className="transport-options">
          <span className="preview-label">交互播放 · 系统朗读</span>
          <button
            className={`quiet ${snap ? "active" : ""}`}
            onClick={() => setSnap(!snap)}
            aria-pressed={snap}
            title="吸附到正文片段"
          >
            <Magnet size={14} />
            吸附
          </button>
          <IconButton
            label="缩小时间轴"
            onClick={() => setZoom(Math.max(1, zoom - 0.25))}
          >
            <ZoomOut size={15} />
          </IconButton>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <IconButton
            label="放大时间轴"
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          >
            <ZoomIn size={15} />
          </IconButton>
        </div>
      </div>
      {!collapsed && (
        <div className="timeline-body">
          <div className="track-labels">
            <div className="ruler-label">时间 / 秒</div>
            {tracks.map((t) => (
              <div className={`track-label ${t.kind}`} key={t.kind}>
                <t.icon size={14} />
                <span>{t.label}</span>
                <button
                  aria-label={`${muted.includes(t.kind) ? "取消静音" : "静音"}${t.label}轨道`}
                  title="轨道静音状态（编排演示）"
                  onClick={() =>
                    setMuted(
                      muted.includes(t.kind)
                        ? muted.filter((k) => k !== t.kind)
                        : [...muted, t.kind],
                    )
                  }
                >
                  {muted.includes(t.kind) ? (
                    <VolumeX size={13} />
                  ) : (
                    <Volume2 size={13} />
                  )}
                </button>
              </div>
            ))}
          </div>
          <div className="track-scroll">
            <div
              className="track-surface"
              ref={trackRef}
              style={{ width: `${zoom * 100}%` }}
            >
              <div
                className="ruler"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onSeek(
                    Math.min(
                      duration,
                      ((e.clientX - r.left) / r.width) * scaleDuration,
                    ),
                  );
                }}
              >
                {Array.from(
                  { length: Math.floor(scaleDuration / 10) + 1 },
                  (_, i) => (
                    <span
                      key={i}
                      style={{ left: `${((i * 10) / scaleDuration) * 100}%` }}
                    >
                      {timeLabel(i * 10)}
                    </span>
                  ),
                )}
              </div>
              {tracks.map((t) => (
                <div
                  className={`track-row ${t.kind} ${muted.includes(t.kind) ? "muted" : ""}`}
                  key={t.kind}
                  onDragOver={(e) => {
                    if (t.kind !== "voice") e.preventDefault();
                  }}
                  onDrop={(e) => drop(e, t.kind)}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      const r = e.currentTarget.getBoundingClientRect();
                      onSeek(
                        Math.min(
                          duration,
                          ((e.clientX - r.left) / r.width) * scaleDuration,
                        ),
                      );
                    }
                  }}
                >
                  {t.kind === "voice"
                    ? chapter.segments.map((s, i) => {
                        const role = project.characters.find(
                          (c) => c.id === s.characterId,
                        )!;
                        return (
                          <button
                            className={`voice-clip ${role.color} ${selectedId === s.id ? "active" : ""}`}
                            key={s.id}
                            style={{
                              left: `${(timings[i].start / scaleDuration) * 100}%`,
                              width: `${((timings[i].end - timings[i].start) / scaleDuration) * 100}%`,
                            }}
                            onClick={() => {
                              select(s.id);
                              onSeek(timings[i].start);
                              document
                                .getElementById(`segment-${s.id}`)
                                ?.scrollIntoView({
                                  block: "center",
                                  behavior: "smooth",
                                });
                            }}
                            title={`${role.name}：${s.text}`}
                          >
                            <span>
                              {role.name}{" "}
                              <i>{String(i + 1).padStart(2, "0")}</i>
                            </span>
                            <Wave seed={i + 1} />
                          </button>
                        );
                      })
                    : chapter.cues
                        .filter((c) => c.kind === t.kind)
                        .map((c) => {
                          const start =
                            drag?.id === c.id
                              ? drag.start
                              : cueStart(chapter, c);
                          const length =
                            drag?.id === c.id
                              ? drag.duration
                              : cueDuration(chapter, c);
                          return (
                            <div
                              role="button"
                              tabIndex={0}
                              aria-label={`拖动${c.name}音轨`}
                              className={`cue-clip ${c.kind} ${activeCue === c.id ? "active" : ""}`}
                              key={c.id}
                              style={{
                                left: `${(start / scaleDuration) * 100}%`,
                                width: `${(length / scaleDuration) * 100}%`,
                              }}
                              onPointerDown={(e) => moveCue(e, c)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") selectCue(c.id);
                                if (
                                  e.key === "ArrowRight" ||
                                  e.key === "ArrowLeft"
                                ) {
                                  e.preventDefault();
                                  updateCue(c.id, {
                                    anchorId: null,
                                    start: Math.max(
                                      0,
                                      cueStart(chapter, c) +
                                        (e.key === "ArrowRight" ? 0.5 : -0.5),
                                    ),
                                    duration: cueDuration(chapter, c),
                                    endAnchorId: undefined,
                                  });
                                }
                              }}
                            >
                              <span>
                                {c.anchorId && <Link2 size={10} />} {c.name}
                              </span>
                              <Wave seed={c.name.length} />
                              <div
                                className="resize-handle"
                                aria-label={`调整${c.name}长度`}
                                onPointerDown={(e) => moveCue(e, c, true)}
                              />
                            </div>
                          );
                        })}
                </div>
              ))}
              <div
                className="playhead"
                style={{
                  left: `${(Math.min(playhead, scaleDuration) / scaleDuration) * 100}%`,
                }}
              >
                <span />
              </div>
              {selectedCue?.anchorId && (
                <div
                  className="anchor-guide"
                  style={{
                    left: `${(cueStart(chapter, selectedCue) / scaleDuration) * 100}%`,
                  }}
                >
                  <Link2 size={11} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {!collapsed && (
        <div className="timeline-foot">
          <span>
            <Link2 size={11} /> 绑定片段的音效随正文移动
          </span>
          <span>拖动移动 · 拖右边缘裁切 · 方向键微调</span>
          <span>音轨与波形为编排示例</span>
        </div>
      )}
    </section>
  );
}

export function CueInspector({
  chapter,
  id,
  close,
}: {
  chapter: Chapter;
  id: string;
  close: () => void;
}) {
  const { updateCue, mutate } = useStudio();
  const cue = chapter.cues.find((c) => c.id === id);
  if (!cue) return null;
  return (
    <aside className={`cue-inspector ${cue.kind}`} aria-label="声音素材设置">
      <header>
        {cue.kind === "music" ? (
          <Music2 size={16} />
        ) : cue.kind === "sfx" ? (
          <Sparkles size={16} />
        ) : (
          <CloudRain size={16} />
        )}
        <strong>
          {cue.kind === "music"
            ? "配乐范围"
            : cue.kind === "sfx"
              ? "句段音效"
              : "环境声音"}
        </strong>
        <IconButton label="关闭声音设置" onClick={close}>
          <X size={15} />
        </IconButton>
      </header>
      <label>
        素材名称
        <input
          value={cue.name}
          onChange={(e) => updateCue(id, { name: e.target.value })}
        />
      </label>
      <label>
        绑定正文
        <select
          value={cue.anchorId ?? ""}
          onChange={(e) => {
            const absolute = cueStart(chapter, cue);
            updateCue(id, {
              anchorId: e.target.value || null,
              start: e.target.value ? 0 : absolute,
              duration: cueDuration(chapter, cue),
              endAnchorId: undefined,
            });
          }}
        >
          <option value="">自由放置（时间锚点）</option>
          {chapter.segments.map((s, i) => (
            <option value={s.id} key={s.id}>
              片段 {String(i + 1).padStart(2, "0")} · {s.text.slice(0, 12)}…
            </option>
          ))}
        </select>
      </label>
      {cue.kind === "music" && cue.anchorId && (
        <label>
          覆盖至
          <select
            value={cue.endAnchorId ?? ""}
            onChange={(e) => {
              if (!e.target.value) {
                updateCue(id, {
                  duration: cueDuration(chapter, cue),
                  endAnchorId: undefined,
                });
                return;
              }
              const t = segmentTimings(chapter).find(
                (t) => t.id === e.target.value,
              );
              if (t)
                updateCue(id, {
                  endAnchorId: t.id,
                  duration: Math.max(0.5, t.next - cueStart(chapter, cue)),
                });
            }}
          >
            <option value="">按时间长度</option>
            {chapter.segments
              .filter(
                (s, i) =>
                  i >= chapter.segments.findIndex((s) => s.id === cue.anchorId),
              )
              .map((s) => (
                <option value={s.id} key={s.id}>
                  {s.text.slice(0, 15)}…
                </option>
              ))}
          </select>
        </label>
      )}
      <div className="cue-numbers">
        <label>
          {cue.anchorId ? "锚点偏移" : "开始时间"} / s
          <input
            type="number"
            min="0"
            step="0.1"
            value={cue.start}
            onChange={(e) =>
              updateCue(id, { start: Math.max(0, +e.target.value) })
            }
          />
        </label>
        <label>
          长度 / s
          <input
            type="number"
            min="0.5"
            max="600"
            step="0.1"
            value={cueDuration(chapter, cue)}
            onChange={(e) =>
              updateCue(id, {
                duration: Math.max(0.5, Math.min(600, +e.target.value)),
                endAnchorId: undefined,
              })
            }
          />
        </label>
      </div>
      <label>
        音量 <b>{cue.gain} dB</b>
        <input
          aria-label="音轨音量"
          type="range"
          min="-40"
          max="0"
          value={cue.gain}
          onChange={(e) => updateCue(id, { gain: +e.target.value })}
        />
      </label>
      <p>拖动音轨后，正文里的覆盖范围会一起变化。</p>
      <button
        className="danger-link"
        onClick={() => {
          mutate("移除声音素材", (p) => {
            const c = p.chapters.find((c) => c.id === chapter.id)!;
            c.cues = c.cues.filter((c) => c.id !== id);
          });
          close();
        }}
      >
        <Trash2 size={13} />
        移除此素材
      </button>
    </aside>
  );
}
