"use client";
import { useState } from "react";
import {
  BookOpen,
  UsersRound,
  Sparkles,
  Music2,
  CloudRain,
  Plus,
  ChevronRight,
  AudioLines,
  GripVertical,
  Pencil,
} from "lucide-react";
import { useStudio } from "@/lib/store";
import {
  chapterDuration,
  timeLabel,
  uid,
  type Character,
  type Cue,
} from "@/lib/project";
export const assets = [
  {
    name: "书店门铃",
    kind: "sfx",
    duration: 2.4,
    description: "清脆 · 近景 · 单次",
  },
  {
    name: "木门轻响",
    kind: "sfx",
    duration: 1.8,
    description: "木质 · 近景 · 单次",
  },
  {
    name: "翻动信纸",
    kind: "sfx",
    duration: 3,
    description: "纸张 · 细节 · 单次",
  },
  {
    name: "悬疑氛围 · 钢琴",
    kind: "music",
    duration: 20,
    description: "缓慢 · 留白 · 无人声",
  },
  {
    name: "黎明 · 弦乐",
    kind: "music",
    duration: 20,
    description: "温暖 · 叙事 · 无人声",
  },
  {
    name: "雨落屋檐",
    kind: "ambience",
    duration: 40,
    description: "小雨 · 室外 · 循环",
  },
  {
    name: "深夜书店",
    kind: "ambience",
    duration: 40,
    description: "室内 · 空间底噪 · 循环",
  },
] as const;
export function Sidebar({
  onImport,
  activeCue,
  selectCue,
  notify,
}: {
  onImport: () => void;
  activeCue: string | null;
  selectCue: (id: string) => void;
  notify: (s: string) => void;
}) {
  const {
    project,
    chapterId,
    selectedId,
    chapter,
    renameChapter,
    updateCharacter,
    mutate,
  } = useStudio();
  const [tab, setTab] = useState("chapters");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const current =
    project.chapters.find((c) => c.id === chapterId) ?? project.chapters[0];
  const tabs = [
    { id: "chapters", icon: BookOpen, label: "章节" },
    { id: "characters", icon: UsersRound, label: "角色" },
    { id: "sfx", icon: Sparkles, label: "音效" },
    { id: "music", icon: Music2, label: "配乐" },
    { id: "ambience", icon: CloudRain, label: "环境" },
  ];
  function addAsset(asset: (typeof assets)[number]) {
    const cue: Cue = {
      id: uid("cue"),
      name: asset.name,
      kind: asset.kind,
      anchorId: selectedId || current.segments[0].id,
      ...(asset.kind === "music"
        ? { endAnchorId: current.segments.at(-1)!.id }
        : {}),
      start: 0,
      duration: asset.duration,
      gain: asset.kind === "sfx" ? -8 : -20,
    };
    mutate("添加声音素材", (p) =>
      p.chapters.find((c) => c.id === current.id)!.cues.push(cue),
    );
    selectCue(cue.id);
    notify("已添加到当前片段，可在时间轴拖动");
  }
  return (
    <aside className="sidebar">
      <div className="project-label">
        当前作品 <span>本地项目</span>
      </div>
      <input
        aria-label="作品名称"
        className="project-name"
        value={project.title}
        onChange={(e) =>
          mutate(
            "重命名作品",
            (p) => {
              p.title = e.target.value;
            },
            "title",
          )
        }
      />
      <select
        className="format-select"
        aria-label="作品类型"
        value={project.format}
        onChange={(e) =>
          mutate("切换作品类型", (p) => {
            p.format = e.target.value as typeof p.format;
          })
        }
      >
        <option>广播剧</option>
        <option>有声剧</option>
        <option>有声小说</option>
      </select>
      <button className="import-button" onClick={onImport}>
        <Plus size={16} /> 导入 / 粘贴文本
      </button>
      <nav className="resource-tabs" aria-label="资源类型">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
            title={t.label}
          >
            <t.icon size={17} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-scroll">
        {tab === "chapters" ? (
          <>
            <div className="section-label">
              章节目录 <span>{project.chapters.length}</span>
            </div>
            <div className="chapter-list">
              {project.chapters.map((c, i) => (
                <div
                  className={`chapter-item ${chapterId === c.id ? "active" : ""}`}
                  key={c.id}
                >
                  <button
                    className="chapter-pick"
                    onClick={() => chapter(c.id)}
                  >
                    <span className="chapter-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      {renameId === c.id ? (
                        <input
                          autoFocus
                          aria-label="修改章节名称"
                          value={c.title}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => renameChapter(c.id, e.target.value)}
                          onBlur={() => setRenameId(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setRenameId(null);
                          }}
                        />
                      ) : (
                        <strong>
                          {c.title.replace(/^第.+?[章回集幕]\s*[·：:]?\s*/, "")}
                        </strong>
                      )}
                      <small>
                        {c.segments.length} 个片段{" "}
                        <span>约 {timeLabel(chapterDuration(c))}</span>
                      </small>
                    </div>
                  </button>
                  <button
                    className="chapter-rename"
                    aria-label={`重命名 ${c.title}`}
                    onClick={() => setRenameId(c.id)}
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="sidebar-note">
              <BookOpen size={16} />
              <p>
                文字是故事的起点。
                <br />
                声音跟随每一次修改。
              </p>
            </div>
          </>
        ) : tab === "characters" ? (
          <>
            <div className="section-label">
              角色与人声 <span>{project.characters.length}</span>
            </div>
            {project.characters.map((c) => (
              <div
                className={`character-card ${editingRole === c.id ? "expanded" : ""}`}
                key={c.id}
              >
                <button
                  className="character-head"
                  onClick={() =>
                    setEditingRole(editingRole === c.id ? null : c.id)
                  }
                >
                  <span className={`avatar ${c.color}`}>{c.name[0]}</span>
                  <div>
                    <strong>{c.name}</strong>
                    <small>{c.description}</small>
                  </div>
                  <ChevronRight size={14} />
                </button>
                {editingRole === c.id && (
                  <div className="character-fields">
                    <label>
                      角色名称
                      <input
                        value={c.name}
                        onChange={(e) =>
                          updateCharacter(c.id, { name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      人声描述
                      <textarea
                        rows={2}
                        value={c.voice}
                        onChange={(e) =>
                          updateCharacter(c.id, { voice: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      默认情绪
                      <select
                        value={c.tone}
                        onChange={(e) =>
                          updateCharacter(c.id, { tone: e.target.value })
                        }
                      >
                        {[
                          "自然",
                          "平静",
                          "警觉",
                          "温柔",
                          "低声",
                          "沉稳",
                          "急促",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      角色语速 <b>{c.speed.toFixed(2)}×</b>
                      <input
                        aria-label={`${c.name}默认语速`}
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={c.speed}
                        onChange={(e) =>
                          updateCharacter(c.id, { speed: +e.target.value })
                        }
                      />
                    </label>
                    <p>影响所有引用该角色的片段；已有生成记录保留原始设置。</p>
                  </div>
                )}
              </div>
            ))}
            <button
              className="quiet add-role"
              onClick={() => {
                const c: Character = {
                  id: uid("role"),
                  name: "新角色",
                  description: "点击编辑人声设置",
                  voice: "待设置音色",
                  tone: "自然",
                  speed: 1,
                  color: "blue",
                };
                mutate("新增角色", (p) => p.characters.push(c));
                setEditingRole(c.id);
              }}
            >
              <Plus size={14} /> 添加角色
            </button>
          </>
        ) : (
          <>
            <div className="section-label">
              {tabs.find((t) => t.id === tab)?.label}素材 <span>可拖动</span>
            </div>
            {assets
              .filter((a) => a.kind === tab)
              .map((a, i) => (
                <div
                  className={`asset-card ${a.kind}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/taleweft-asset",
                      JSON.stringify(a),
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  key={a.name}
                >
                  <GripVertical size={13} />
                  <span className="asset-symbol">
                    {a.kind === "sfx" ? (
                      <Sparkles size={19} />
                    ) : a.kind === "music" ? (
                      <Music2 size={19} />
                    ) : (
                      <CloudRain size={19} />
                    )}
                  </span>
                  <div>
                    <strong>{a.name}</strong>
                    <small>{a.description}</small>
                  </div>
                  <button
                    aria-label={`添加${a.name}`}
                    onClick={() => addAsset(a)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              ))}
            <p className="asset-hint">
              拖到音轨放置，或点击 +
              绑定当前片段。此处为素材编排示例，尚未附带音频文件。
            </p>
            <div className="section-label">本章已使用</div>
            {current.cues
              .filter((c) => c.kind === tab)
              .map((c) => (
                <button
                  key={c.id}
                  className={`used-cue ${activeCue === c.id ? "active" : ""}`}
                  onClick={() => selectCue(c.id)}
                >
                  <AudioLines size={15} />
                  {c.name}
                  <span>{c.gain} dB</span>
                </button>
              ))}
          </>
        )}
      </div>
      <div className="sidebar-bottom">
        <span className="small-mark">TW</span>
        <div>
          TaleWeft Playground<small>前端交互探索 · v0.1</small>
        </div>
      </div>
    </aside>
  );
}
