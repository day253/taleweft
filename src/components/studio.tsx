"use client";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Undo2,
  Redo2,
  Download,
  Check,
  CloudOff,
  SlidersHorizontal,
  BookOpen,
  Sparkles,
  ChevronRight,
  Upload,
  ArrowUpRight,
  X,
} from "lucide-react";
import { useStudio, usePersistence } from "@/lib/store";
import {
  chapterDuration,
  segmentTimings,
  timeLabel,
  type Segment,
} from "@/lib/project";
import { Sidebar } from "./sidebar";
import { SegmentEditor } from "./segment-editor";
import { Timeline, CueInspector } from "./timeline";
import { ImportDialog, LocalEditDialog } from "./dialogs";
import { IconButton } from "./ui";

export default function Studio() {
  const state = useStudio();
  const { project, chapterId, selectedId, ready, revision, undo, redo } = state;
  const persistence = usePersistence((s) => s.status);
  const chapter =
    project.chapters.find((c) => c.id === chapterId) ?? project.chapters[0];
  const [reading, setReading] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [importOpen, setImportOpen] = useState(false);
  const [localOpen, setLocalOpen] = useState(false);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const headRef = useRef(0);
  headRef.current = playhead;
  useEffect(() => {
    void useStudio.persist.rehydrate();
    return () => {
      window.speechSynthesis?.cancel();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    setActiveCue(null);
    setPlayhead(0);
    setPlaying(false);
    window.speechSynthesis?.cancel();
  }, [chapter.id]);
  useEffect(() => {
    setPlaying(false);
    window.speechSynthesis?.cancel();
  }, [revision]);
  function notify(s: string) {
    setToast(s);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }
  function speak(text: string, rate = 1) {
    if (!("speechSynthesis" in window)) {
      notify("浏览器不支持系统朗读；仍可操作时间轴");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }
  function togglePlay() {
    if (playing) {
      setPlaying(false);
      window.speechSynthesis?.cancel();
      return;
    }
    let pos = playhead;
    if (pos >= chapterDuration(chapter)) {
      pos = 0;
      setPlayhead(0);
    }
    const timings = segmentTimings(chapter);
    const index = Math.max(
      0,
      timings.findIndex((t) => t.end >= pos),
    );
    speak(
      chapter.segments
        .slice(index)
        .map((s) => s.text)
        .join(" "),
    );
    setPlaying(true);
  }
  function seek(n: number) {
    setPlayhead(n);
    if (playing) {
      const timings = segmentTimings(chapter);
      const index = Math.max(
        0,
        timings.findIndex((t) => t.end >= n),
      );
      speak(
        chapter.segments
          .slice(index)
          .map((s) => s.text)
          .join(" "),
      );
    }
  }
  function preview(block: Segment) {
    setPlaying(false);
    const role = project.characters.find((c) => c.id === block.characterId)!;
    speak(block.text, block.speed * role.speed);
    notify("正在用系统语音朗读当前片段，非模型生成音频");
  }
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const next = headRef.current + (now - previous) / 1000;
      previous = now;
      if (next >= chapterDuration(chapter)) {
        setPlayhead(chapterDuration(chapter));
        setPlaying(false);
        window.speechSynthesis?.cancel();
      } else setPlayhead(next);
    }, 50);
    return () => clearInterval(timer);
  }, [playing, chapter]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (
        el.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    if (!project.chapters.some((c) => c.id === chapterId))
      state.chapter(project.chapters[0].id);
  }, [project, chapterId, state]);
  function exportProject() {
    const blob = new Blob(
      [JSON.stringify({ schemaVersion: 1, project }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title || "taleweft"}-project.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("已导出可读取的项目 JSON，未导出音频");
  }
  const currentTime = segmentTimings(chapter).find(
    (t) => playhead >= t.start && playhead < t.next,
  )?.id;
  return (
    <div
      className={`studio ${reading ? "reading-mode" : ""}`}
      style={{ "--reading-size": `${fontSize}px` } as React.CSSProperties}
    >
      <header className="app-header">
        <a className="brand" href="/" aria-label="TaleWeft 章节编辑器">
          <span className="brand-mark">
            <AudioLines size={22} />
          </span>
          <strong>TaleWeft</strong>
          <span className="brand-divider" />
          <span className="workspace-name">创作空间</span>
        </a>
        <div className="header-center">
          <span>作品</span>
          <ChevronRight size={12} />
          <strong>{project.title}</strong>
        </div>
        <div className="header-actions">
          <span className="save-state">
            {persistence === "error" ? (
              <CloudOff size={13} />
            ) : (
              <Check size={13} />
            )}{" "}
            {!ready
              ? "正在读取"
              : persistence === "error"
                ? "保存失败，请导出备份"
                : persistence === "saving"
                  ? "正在保存"
                  : "已存到本机"}
          </span>
          <span className="prototype-tag">交互原型</span>
          <div className="undo-group">
            <IconButton
              label="撤销最近修改"
              disabled={!state.past.length}
              onClick={undo}
            >
              <Undo2 size={16} />
            </IconButton>
            <IconButton
              label="重做修改"
              disabled={!state.future.length}
              onClick={redo}
            >
              <Redo2 size={16} />
            </IconButton>
          </div>
          <button className="secondary" onClick={exportProject}>
            <Download size={14} />
            导出项目
          </button>
        </div>
      </header>
      <Sidebar
        onImport={() => setImportOpen(true)}
        activeCue={activeCue}
        selectCue={setActiveCue}
        notify={notify}
      />
      <main className="editor-workspace">
        <div className="editor-toolbar">
          <div className="view-switch">
            <button
              className={!reading ? "active" : ""}
              onClick={() => setReading(false)}
            >
              <SlidersHorizontal size={14} />
              正文编辑
            </button>
            <button
              className={reading ? "active" : ""}
              onClick={() => setReading(true)}
            >
              <BookOpen size={14} />
              沉浸阅读
            </button>
          </div>
          <div className="editor-tools">
            <span>字体</span>
            <button
              aria-label="缩小正文字体"
              onClick={() => setFontSize(Math.max(16, fontSize - 1))}
            >
              A−
            </button>
            <button
              aria-label="增大正文字体"
              onClick={() => setFontSize(Math.min(24, fontSize + 1))}
            >
              A+
            </button>
            <span className="tool-divider" />
            <button className="quiet" onClick={() => setLocalOpen(true)}>
              <Sparkles size={14} />
              局部修改
            </button>
          </div>
        </div>
        <div className="document-scroll">
          <article className="chapter-document">
            <div className="chapter-eyebrow">
              <span>
                CHAPTER{" "}
                {String(
                  project.chapters.findIndex((c) => c.id === chapter.id) + 1,
                ).padStart(2, "0")}
              </span>
              <span>
                {project.format} <i />约 {timeLabel(chapterDuration(chapter))}
              </span>
            </div>
            <input
              aria-label="章节标题"
              className="chapter-title"
              value={chapter.title}
              onChange={(e) => state.renameChapter(chapter.id, e.target.value)}
            />
            <div className="chapter-metadata">
              <span>{chapter.segments.length} 个片段</span>
              <span>
                {new Set(chapter.segments.map((s) => s.characterId)).size}{" "}
                位角色
              </span>
              <span>{chapter.cues.length} 条声音素材</span>
              <span className="chapter-mode">正文与音轨联动</span>
            </div>
            {!reading && (
              <div className="interaction-hint">
                <span className="hint-key">点选</span>
                <span>
                  正文直接编辑，角色就地切换；展开片段，微调声音与查看生成记录。
                </span>
              </div>
            )}
            <div className="chapter-content">
              {chapter.segments.map((s, i) => (
                <div
                  key={s.id}
                  className={
                    playing && currentTime === s.id ? "currently-playing" : ""
                  }
                >
                  <SegmentEditor
                    block={s}
                    index={i}
                    chapter={chapter}
                    reading={reading}
                    activeCue={activeCue}
                    selectCue={setActiveCue}
                    preview={preview}
                    openLocal={() => setLocalOpen(true)}
                  />
                </div>
              ))}
            </div>
            <div className="chapter-end">
              <span />
              <span>本章完</span>
              <span />
            </div>
            <button
              className="next-chapter"
              onClick={() => {
                const i = project.chapters.findIndex(
                  (c) => c.id === chapter.id,
                );
                if (i < project.chapters.length - 1)
                  state.chapter(project.chapters[i + 1].id);
                else notify("已经是最后一章");
              }}
            >
              {project.chapters.findIndex((c) => c.id === chapter.id) <
              project.chapters.length - 1
                ? "继续下一章"
                : "已到最后一章"}
              <ArrowUpRight size={14} />
            </button>
          </article>
        </div>
        {activeCue && (
          <CueInspector
            chapter={chapter}
            id={activeCue}
            close={() => setActiveCue(null)}
          />
        )}
      </main>
      <Timeline
        chapter={chapter}
        playing={playing}
        playhead={playhead}
        onPlay={togglePlay}
        onSeek={seek}
        activeCue={activeCue}
        selectCue={setActiveCue}
        notify={notify}
      />
      {importOpen && (
        <ImportDialog close={() => setImportOpen(false)} notify={notify} />
      )}
      {localOpen && (
        <LocalEditDialog close={() => setLocalOpen(false)} notify={notify} />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={14} />
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
