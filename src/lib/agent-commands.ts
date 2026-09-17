import { z } from "zod";
import { estimateDuration, type Project } from "./project";
const id = z.string().min(1).max(120);
const text = z.string().max(100_000);
const changes = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .strict()
    .refine((v) => Object.keys(v).length > 0, "修改不能为空");
export const agentEditSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("segment"),
      id,
      changes: changes({
        text: text.optional(),
        characterId: id.optional(),
        emotion: z.string().max(80).optional(),
        speed: z.number().min(0.5).max(1.5).optional(),
        pause: z.number().min(0).max(3).optional(),
      }),
    })
    .strict(),
  z
    .object({
      kind: z.literal("character"),
      id,
      changes: changes({
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(3000).optional(),
        voice: z.string().max(1000).optional(),
        tone: z.string().max(80).optional(),
        speed: z.number().min(0.5).max(1.5).optional(),
      }),
    })
    .strict(),
  z
    .object({
      kind: z.literal("cue"),
      id,
      changes: changes({
        name: z.string().min(1).max(120).optional(),
        anchorId: id.nullable().optional(),
        endAnchorId: id.nullable().optional(),
        start: z.number().min(0).max(86400).optional(),
        duration: z.number().min(0.5).max(3600).optional(),
        gain: z.number().min(-60).max(0).optional(),
      }),
    })
    .strict(),
]);
export const editsSchema = z
  .array(agentEditSchema)
  .min(1)
  .max(50)
  .refine(
    (edits) =>
      new Set(edits.map((edit) => `${edit.kind}:${edit.id}`)).size ===
      edits.length,
    "每个对象的修改请合并成一条指令",
  );
export type AgentEdit = z.infer<typeof agentEditSchema>;
export type AgentProposal = {
  id: string;
  title: string;
  projectId: string;
  baseRevision: number;
  edits: AgentEdit[];
  before?: Record<string, unknown>[];
  status: "pending" | "applied" | "rejected" | "conflict";
  createdAt: string;
};
export function applyAgentEdits(project: Project, input: unknown): Project {
  const edits = editsSchema.parse(input);
  const copy = structuredClone(project);
  for (const edit of edits) {
    if (edit.kind === "segment") {
      const block = copy.chapters
        .flatMap((c) => c.segments)
        .find((s) => s.id === edit.id);
      if (!block) throw new Error(`片段不存在：${edit.id}`);
      if (
        edit.changes.characterId &&
        !copy.characters.some((c) => c.id === edit.changes.characterId)
      )
        throw new Error("角色不存在");
      Object.assign(block, edit.changes, { status: "stale" });
      if (edit.changes.text !== undefined)
        block.duration = estimateDuration(edit.changes.text);
    } else if (edit.kind === "character") {
      const role = copy.characters.find((c) => c.id === edit.id);
      if (!role) throw new Error(`角色不存在：${edit.id}`);
      Object.assign(role, edit.changes);
      for (const block of copy.chapters.flatMap((c) => c.segments))
        if (block.characterId === role.id) block.status = "stale";
    } else {
      const chapter = copy.chapters.find((c) =>
        c.cues.some((cue) => cue.id === edit.id),
      );
      const cue = chapter?.cues.find((c) => c.id === edit.id);
      if (!chapter || !cue) throw new Error(`声音素材不存在：${edit.id}`);
      Object.assign(cue, edit.changes);
      if (edit.changes.endAnchorId === null) delete cue.endAnchorId;
      if (edit.changes.anchorId === null || edit.changes.duration !== undefined)
        delete cue.endAnchorId;
      const start = chapter.segments.findIndex((s) => s.id === cue.anchorId);
      const end = chapter.segments.findIndex((s) => s.id === cue.endAnchorId);
      if (cue.anchorId && start < 0)
        throw new Error("声音起点必须在同一章节中");
      if (cue.endAnchorId && (!cue.anchorId || end < start))
        throw new Error("配乐结束段落必须在起点之后");
    }
  }
  return copy;
}
