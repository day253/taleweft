"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Check, X, Copy, Unplug } from "lucide-react";
import { useStudio } from "@/lib/store";
import { applyAgentEdits, type AgentProposal } from "@/lib/agent-commands";
import { compareText } from "@/lib/text-diff";
import { Modal } from "./ui";

type Decision = { id: string; status: "applied" | "rejected" | "conflict" };
export function AgentBridge() {
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [error, setError] = useState("");
  const [healthy, setHealthy] = useState(false);
  const [copied, setCopied] = useState(false);
  const token = useRef("");
  const decisions = useRef<Decision[]>([]);
  const alive = useRef(false);
  const syncing = useRef<Promise<void>>(Promise.resolve());
  const state = useStudio();
  useEffect(() => {
    let value = sessionStorage.getItem("taleweft-dsh-connection");
    if (!value) {
      value = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      sessionStorage.setItem("taleweft-dsh-connection", value);
    }
    token.current = value;
  }, []);
  function sync(isConnected: boolean) {
    const next = syncing.current.catch(() => {}).then(() => sendSnapshot(isConnected));
    syncing.current = next;
    return next;
  }
  async function sendSnapshot(isConnected: boolean) {
    const s = useStudio.getState();
    const batch = [...decisions.current];
    const response = await fetch("/api/agent-bridge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-taleweft-connection": token.current,
      },
      body: JSON.stringify({
        project: s.project,
        revision: s.revision,
        selection: {
          chapterId: s.chapterId,
          segmentId: s.selectedId,
          text: s.selectedText,
        },
        connected: isConnected,
        decisions: batch,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "同步失败");
    decisions.current = decisions.current.filter(
      (d) => !batch.some((b) => b.id === d.id),
    );
    if (alive.current) {
      setWorkspaceId(result.workspaceId);
      setProposals(
        result.proposals.map((p: AgentProposal) => {
          const decision = decisions.current.find((d) => d.id === p.id);
          return decision ? { ...p, status: decision.status } : p;
        }),
      );
      setHealthy(isConnected);
      setError("");
    }
  }
  useEffect(() => {
    if (!connected) return;
    alive.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        await sync(true);
      } catch (e) {
        if (alive.current) {
          setError((e as Error).message);
          setHealthy(false);
        }
      } finally {
        if (!cancelled) timer = setTimeout(poll, 1000);
      }
    }
    void poll();
    return () => {
      alive.current = false;
      cancelled = true;
      clearTimeout(timer);
    };
  }, [connected]);
  async function disconnect() {
    alive.current = false;
    setConnected(false);
    setHealthy(false);
    try {
      await sync(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function decide(proposal: AgentProposal, status: Decision["status"]) {
    try {
      if (status === "applied") {
        const s = useStudio.getState();
        if (
          proposal.projectId !== s.project.id ||
          proposal.baseRevision !== s.revision
        )
          throw new Error(
            "你已继续编辑，这条建议需要 Agent 重新读取上下文后生成。",
          );
        const next = applyAgentEdits(s.project, proposal.edits);
        s.mutate("应用 dsh 修改建议", (p) => Object.assign(p, next));
      }
      decisions.current.push({ id: proposal.id, status });
      setProposals((list) =>
        list.map((p) => (p.id === proposal.id ? { ...p, status } : p)),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const pending = proposals.filter((p) => p.status === "pending");
  const prompt = `请使用 TaleWeft 工具读取工作区 ${workspaceId || "（先连接编辑器）"} 的当前章节和选中片段，再根据我的要求提出修改建议。使用 taleweft_propose_edit，不直接改文件。要求：`;
  return (
    <>
      <button
        className={`secondary dsh-button ${healthy ? "connected" : ""}`}
        onClick={() => setOpen(true)}
      >
        <Bot size={15} />
        dsh{" "}
        {pending.length > 0 ? <b>{pending.length}</b> : healthy ? "已连接" : ""}
      </button>
      {open && (
        <Modal title="与 dsh Agent 协作" wide close={() => setOpen(false)}>
          <div className="dsh-panel">
            <p>
              在 dsh 里描述你想怎么改。Agent
              读取当前章节、角色与声音编排，把修改建议送到这里；你查看差异后应用，可一次撤销。
            </p>
            <div className="dsh-connect">
              <span className={healthy ? "online" : ""}>
                {healthy
                  ? "编辑器已连接，正在同步选区和修改"
                  : connected
                    ? "正在连接…"
                    : "尚未连接"}
              </span>
              {connected ? (
                <button className="secondary small" onClick={disconnect}>
                  <Unplug size={13} />
                  断开
                </button>
              ) : (
                <button
                  className="primary small"
                  disabled={!state.ready}
                  onClick={() => setConnected(true)}
                >
                  <Bot size={13} />
                  连接 dsh
                </button>
              )}
            </div>
            <small>
              连接后，当前作品会同步到本机，供已安装的 TaleWeft dsh
              插件读取。dsh 中调用工具时，相应上下文会交给你配置的模型。
            </small>
            {connected && workspaceId && (
              <div className="dsh-prompt">
                <label>
                  把这段话发给 dsh，补上你的修改要求
                  <textarea
                    aria-label="发给 dsh 的上下文指令"
                    value={prompt}
                    readOnly
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <button
                  className="quiet"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(prompt);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                      setError("请选中上方文字复制到 dsh");
                    }
                  }}
                >
                  <Copy size={12} />
                  {copied ? "已复制" : "复制指令"}
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="dsh-proposals">
              <h3>
                Agent 修改建议 <span>{pending.length} 条待处理</span>
              </h3>
              {!proposals.length && (
                <p className="dsh-empty">
                  等 Agent 提出建议。可以试试：“把选中这句改得更紧张，停顿 0.8
                  秒。”
                </p>
              )}
              {[...proposals].reverse().map((proposal) => {
                const outdated =
                  proposal.projectId !== state.project.id ||
                  proposal.baseRevision !== state.revision;
                return (
                  <section className="dsh-proposal" key={proposal.id}>
                    <header>
                      <strong>{proposal.title}</strong>
                      <span>
                        {
                          {
                            pending: outdated ? "内容已变化" : "待确认",
                            applied: "已应用",
                            rejected: "已拒绝",
                            conflict: "内容已变化",
                          }[proposal.status]
                        }
                      </span>
                    </header>
                    {proposal.edits.map((edit, i) => {
                      const target =
                        edit.kind === "segment"
                          ? state.project.chapters
                              .flatMap((c) => c.segments)
                              .find((s) => s.id === edit.id)
                          : edit.kind === "character"
                            ? state.project.characters.find(
                                (c) => c.id === edit.id,
                              )
                            : state.project.chapters
                                .flatMap((c) => c.cues)
                                .find((c) => c.id === edit.id);
                      const diff =
                        edit.kind === "segment" &&
                        edit.changes.text !== undefined &&
                        target &&
                        "text" in target
                          ? compareText(
                              String(proposal.before?.[i]?.text ?? target.text),
                              edit.changes.text,
                            )
                          : null;
                      return (
                        <div className="dsh-edit" key={i}>
                          <strong>
                            {edit.kind === "segment"
                              ? "片段"
                              : edit.kind === "character"
                                ? "角色"
                                : "声音素材"}{" "}
                            ·{" "}
                            {target && "name" in target
                              ? target.name
                              : `${state.project.chapters.flatMap((c) => c.segments).findIndex((s) => s.id === edit.id) + 1}`}
                          </strong>
                          {diff && (
                            <div className="compare-columns">
                              <section>
                                <h4>修改前</h4>
                                <div className="compare-copy">
                                  {diff.changes
                                    .filter((c) => !c.added)
                                    .map((c, j) =>
                                      c.removed ? (
                                        <del key={j}>{c.value}</del>
                                      ) : (
                                        <span key={j}>{c.value}</span>
                                      ),
                                    )}
                                </div>
                              </section>
                              <section>
                                <h4>Agent 建议</h4>
                                <div className="compare-copy">
                                  {diff.changes
                                    .filter((c) => !c.removed)
                                    .map((c, j) =>
                                      c.added ? (
                                        <ins key={j}>{c.value}</ins>
                                      ) : (
                                        <span key={j}>{c.value}</span>
                                      ),
                                    )}
                                </div>
                              </section>
                            </div>
                          )}
                          {Object.entries(edit.changes)
                            .filter(([key]) => key !== "text")
                            .map(([key, value]) => (
                              <p className="dsh-field" key={key}>
                                <span>
                                  {{
                                    characterId: "演播角色",
                                    emotion: "情绪",
                                    speed: "语速",
                                    pause: "停顿",
                                    name: "名称",
                                    description: "角色设定",
                                    voice: "声音描述",
                                    tone: "默认语气",
                                    anchorId: "起始段落",
                                    endAnchorId: "结束段落",
                                    start: "起点偏移 / 秒",
                                    duration: "长度 / 秒",
                                    gain: "音量 / dB",
                                  }[key] || key}
                                </span>
                                <del>
                                  {String(
                                    proposal.before?.[i]?.[key] ??
                                      target?.[key as keyof typeof target] ??
                                      "无",
                                  )}
                                </del>
                                <span>→</span>
                                <b>{String(value ?? "自由放置")}</b>
                              </p>
                            ))}
                        </div>
                      );
                    })}
                    {proposal.status === "pending" && (
                      <footer>
                        <button
                          className="secondary small"
                          onClick={() => decide(proposal, "rejected")}
                        >
                          <X size={13} />
                          拒绝
                        </button>
                        <button
                          className="primary small"
                          disabled={outdated || !healthy}
                          onClick={() => decide(proposal, "applied")}
                        >
                          <Check size={13} />
                          应用修改
                        </button>
                      </footer>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
