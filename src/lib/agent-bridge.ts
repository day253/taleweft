import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import lockfile from "proper-lockfile";
import { z } from "zod";
import {
  applyAgentEdits,
  editsSchema,
  type AgentProposal,
} from "./agent-commands";
import { seedProject, type Project } from "./project";

export type BridgeRecord = {
  id: string;
  project: Project;
  revision: number;
  selection: { chapterId: string; segmentId: string; text: string };
  connected: boolean;
  updatedAt: number;
  proposals: AgentProposal[];
};
const id = z.string().min(1).max(120);
const projectSchema = z.object({
  id,
  title: z.string().max(1000),
  format: z.enum(["有声剧", "广播剧", "有声小说"]),
  sourceText: z.string().max(100_000).optional(),
  characters: z
    .array(
      z.object({
        id,
        name: z.string().max(1000),
        description: z.string().max(10000),
        voice: z.string().max(10000),
        tone: z.string().max(1000),
        speed: z.number().min(0.1).max(5),
        color: z.string().max(40),
      }),
    )
    .min(1)
    .max(1000),
  chapters: z
    .array(
      z.object({
        id,
        title: z.string().max(1000),
        segments: z
          .array(
            z.object({
              id,
              text: z.string().max(100_000),
              original: z
                .object({
                  text: z.string().max(100_000),
                  kind: z.enum(["import", "sample"]),
                })
                .optional(),
              characterId: id,
              emotion: z.string().max(1000),
              speed: z.number().min(0.1).max(5),
              pause: z.number().min(0).max(60),
              duration: z.number().min(0).max(86400),
              model: z.string().max(1000),
              status: z.enum(["draft", "stale"]),
            }),
          )
          .min(1)
          .max(10000),
        cues: z
          .array(
            z.object({
              id,
              name: z.string().max(1000),
              kind: z.enum(["sfx", "music", "ambience"]),
              anchorId: id.nullable(),
              endAnchorId: id.optional(),
              start: z.number().min(0).max(86400),
              duration: z.number().min(0).max(86400),
              gain: z.number().min(-100).max(10),
            }),
          )
          .max(10000),
      }),
    )
    .min(1)
    .max(1000),
});
const syncSchema = z.object({
  project: projectSchema,
  revision: z.number().int().nonnegative(),
  selection: z.object({
    chapterId: id,
    segmentId: z.string().max(120),
    text: z.string().max(100_000),
  }),
  connected: z.boolean(),
  decisions: z
    .array(
      z.object({ id, status: z.enum(["applied", "rejected", "conflict"]) }),
    )
    .max(50)
    .default([]),
});
export const bridgeDirectory = () =>
  resolve(
    /* turbopackIgnore: true */
    process.env.TALEWEFT_BRIDGE_DIR ||
      join(process.cwd(), ".taleweft", "bridge"),
  );
export const connectionId = (token: string) => {
  if (!/^[a-f0-9]{48}$/.test(token)) throw new Error("无效的编辑器连接标识");
  return createHash("sha256").update(token).digest("hex");
};
function filePath(directory: string, key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("无效的工作区 ID");
  return join(directory, `${key}.json`);
}
async function load(
  directory: string,
  key: string,
): Promise<BridgeRecord | null> {
  try {
    return JSON.parse(await readFile(filePath(directory, key), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
async function transaction<T>(
  directory: string,
  key: string,
  update: (current: BridgeRecord | null) => { record: BridgeRecord; value: T },
  signal?: AbortSignal,
): Promise<T> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = filePath(directory, key);
  const release = await lockfile.lock(path, {
    realpath: false,
    retries: { retries: 10, minTimeout: 20, maxTimeout: 100 },
  });
  try {
    signal?.throwIfAborted();
    const result = update(await load(directory, key));
    signal?.throwIfAborted();
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(result.record), { mode: 0o600 });
    await rename(temporary, path);
    return result.value;
  } finally {
    await release();
  }
}
export async function syncEditor(
  directory: string,
  token: string,
  input: unknown,
) {
  const data = syncSchema.parse(input);
  const key = connectionId(token);
  return transaction(directory, key, (current) => {
    let proposals =
      current?.project.id === data.project.id ? current.proposals : [];
    proposals = proposals.map((p) => {
      if (p.status !== "pending") return p;
      const decision = data.decisions.find((d) => d.id === p.id);
      if (decision) return { ...p, status: decision.status };
      return p.baseRevision !== data.revision
        ? { ...p, status: "conflict" as const }
        : p;
    });
    const record: BridgeRecord = {
      id: key,
      project: data.project,
      revision: data.revision,
      selection: data.selection,
      connected: data.connected,
      updatedAt: Date.now(),
      proposals,
    };
    return {
      record,
      value: { workspaceId: key, proposals, connected: record.connected },
    };
  });
}
function requireLive(record: BridgeRecord | null): BridgeRecord {
  if (!record || !record.connected || Date.now() - record.updatedAt > 15000)
    throw new Error(
      "编辑器未连接或已离线。请打开 TaleWeft，点击「连接 dsh」。",
    );
  return record;
}
export async function listWorkspaces(directory: string) {
  let files: string[];
  try {
    files = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const records = await Promise.all(
    files
      .filter((f) => /^[a-f0-9]{64}\.json$/.test(f))
      .map((f) => load(directory, f.slice(0, -5))),
  );
  return records
    .filter(
      (r): r is BridgeRecord =>
        !!r && r.connected && Date.now() - r.updatedAt < 15000,
    )
    .map((r) => ({
      workspaceId: r.id,
      title: r.project.title,
      format: r.project.format,
      revision: r.revision,
      selection: r.selection,
      updatedAt: r.updatedAt,
    }));
}
export async function readContext(
  directory: string,
  key: string,
  chapterId?: string,
) {
  const record = requireLive(await load(directory, key));
  const chapter = record.project.chapters.find(
    (c) => c.id === (chapterId || record.selection.chapterId),
  );
  if (!chapter) throw new Error("章节不存在");
  const selected = chapter.segments.find(
    (s) => s.id === record.selection.segmentId,
  );
  const sample =
    record.project.id === seedProject.id
      ? seedProject.chapters
          .flatMap((c) => c.segments)
          .find((s) => s.id === selected?.id)
      : undefined;
  return {
    workspaceId: key,
    projectId: record.project.id,
    title: record.project.title,
    revision: record.revision,
    selection: record.selection,
    chapters: record.project.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      segments: c.segments.length,
    })),
    characters: record.project.characters,
    chapter,
    provenance: sample
      ? {
          kind: "design-example",
          note: "非真实模型生成，仅供交互原型 Debug",
          input: sample,
        }
      : null,
    pending: record.proposals.filter((p) => p.status === "pending"),
  };
}
export async function proposeEdits(
  directory: string,
  key: string,
  input: unknown,
  signal?: AbortSignal,
) {
  const proposalInput = z
    .object({
      title: z.string().min(1).max(160),
      projectId: id,
      baseRevision: z.number().int().nonnegative(),
      edits: editsSchema,
    })
    .strict()
    .parse(input);
  return transaction(directory, key, (current) => {
    const record = requireLive(current);
    if (
      record.project.id !== proposalInput.projectId ||
      record.revision !== proposalInput.baseRevision
    )
      throw new Error("作品已变化，请重新读取上下文后提出修改。");
    if (record.proposals.filter((p) => p.status === "pending").length >= 10)
      throw new Error("待处理建议过多，请先在编辑器中处理。");
    applyAgentEdits(record.project, proposalInput.edits);
    const proposal: AgentProposal = {
      ...proposalInput,
      before: proposalInput.edits.map((edit) => {
        const target =
          edit.kind === "segment"
            ? record.project.chapters
                .flatMap((c) => c.segments)
                .find((s) => s.id === edit.id)
            : edit.kind === "character"
              ? record.project.characters.find((c) => c.id === edit.id)
              : record.project.chapters
                  .flatMap((c) => c.cues)
                  .find((c) => c.id === edit.id);
        return Object.fromEntries(
          Object.keys(edit.changes).map((key) => [
            key,
            (target as unknown as Record<string, unknown>)[key] ?? null,
          ]),
        );
      }),
      id: randomUUID(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    record.proposals = [...record.proposals.slice(-49), proposal];
    return { record, value: proposal };
  }, signal);
}
export async function proposalStatus(
  directory: string,
  key: string,
  id: string,
) {
  const record = await load(directory, key);
  const proposal = record?.proposals.find((p) => p.id === id);
  if (!proposal) throw new Error("未找到修改建议");
  return {
    id: proposal.id,
    title: proposal.title,
    status: proposal.status,
    revision: record!.revision,
    editorOnline: record!.connected && Date.now() - record!.updatedAt < 15000,
  };
}
