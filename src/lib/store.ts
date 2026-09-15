"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { get, set, del } from "idb-keyval";
import {
  applyPatches,
  migrateOriginals,
  restoreOriginal,
  seedProject,
  type Project,
  type Proposal,
  type Segment,
  type Cue,
  type Character,
} from "./project";

type Snapshot = { project: Project; label: string };
export const usePersistence = create<{ status: "saved" | "saving" | "error" }>(
  () => ({ status: "saved" }),
);
type StudioState = {
  project: Project;
  revision: number;
  chapterId: string;
  selectedId: string;
  selectedText: string;
  expandedId: string | null;
  ready: boolean;
  storageError: boolean;
  saved: boolean;
  past: Snapshot[];
  future: Snapshot[];
  lastKey: string;
  lastTime: number;
  setReady: () => void;
  select: (id: string, text?: string) => void;
  chapter: (id: string) => void;
  expand: (id: string | null) => void;
  mutate: (label: string, recipe: (p: Project) => void, key?: string) => void;
  updateSegment: (id: string, data: Partial<Omit<Segment, "original">>) => void;
  restoreOriginalText: (id: string) => void;
  updateCue: (id: string, data: Partial<Cue>) => void;
  updateCharacter: (id: string, data: Partial<Character>) => void;
  renameChapter: (id: string, title: string) => void;
  replaceProject: (p: Project) => void;
  applyProposal: (p: Proposal) => void;
  undo: () => void;
  redo: () => void;
};
export const useStudio = create<StudioState>()(
  persist(
    (setState, getState) => ({
      project: structuredClone(seedProject),
      revision: 1,
      chapterId: "chapter-1",
      selectedId: "s2",
      selectedText: "",
      expandedId: null,
      ready: false,
      storageError: false,
      saved: true,
      past: [],
      future: [],
      lastKey: "",
      lastTime: 0,
      setReady: () => setState({ ready: true }),
      select: (id, text = "") =>
        setState({ selectedId: id, selectedText: text }),
      chapter: (id) => {
        const first = getState().project.chapters.find((c) => c.id === id)
          ?.segments[0];
        setState({
          chapterId: id,
          selectedId: first?.id ?? "",
          selectedText: "",
          expandedId: null,
        });
      },
      expand: (expandedId) => setState({ expandedId }),
      mutate: (label, recipe, key = "") => {
        const s = getState();
        const p = structuredClone(s.project);
        recipe(p);
        const coalesce =
          key && key === s.lastKey && Date.now() - s.lastTime < 1200;
        setState({
          project: p,
          revision: s.revision + 1,
          saved: false,
          future: [],
          past: coalesce
            ? s.past
            : [...s.past.slice(-29), { project: s.project, label }],
          lastKey: key,
          lastTime: Date.now(),
        });
      },
      updateSegment: (id, data) =>
        getState().mutate(
          "编辑片段",
          (p) => {
            const s = p.chapters
              .flatMap((c) => c.segments)
              .find((s) => s.id === id);
            if (s)
              Object.assign(s, data, { original: s.original, status: "stale" });
          },
          `segment:${id}`,
        ),
      restoreOriginalText: (id) => {
        const next = restoreOriginal(getState().project, id);
        getState().mutate("恢复片段原文", (p) => Object.assign(p, next));
      },
      updateCue: (id, data) =>
        getState().mutate(
          "移动或编辑音轨",
          (p) => {
            const cue = p.chapters
              .flatMap((c) => c.cues)
              .find((c) => c.id === id);
            if (cue) Object.assign(cue, data);
          },
          `cue:${id}`,
        ),
      updateCharacter: (id, data) =>
        getState().mutate(
          "编辑角色人声",
          (p) => {
            const c = p.characters.find((c) => c.id === id);
            if (c) Object.assign(c, data);
            for (const s of p.chapters.flatMap((c) => c.segments))
              if (s.characterId === id) s.status = "stale";
          },
          `character:${id}`,
        ),
      renameChapter: (id, title) =>
        getState().mutate(
          "重命名章节",
          (p) => {
            const c = p.chapters.find((c) => c.id === id);
            if (c) c.title = title;
          },
          `chapter:${id}`,
        ),
      replaceProject: (project) => {
        getState().mutate("导入并应用拆分", (p) => Object.assign(p, project));
        setState({
          chapterId: project.chapters[0].id,
          selectedId: project.chapters[0].segments[0].id,
          selectedText: "",
          expandedId: null,
        });
      },
      applyProposal: (proposal) => {
        const s = getState();
        if (proposal.revision !== s.revision)
          throw new Error("内容已变化，请重新预览建议后再应用。");
        const p = applyPatches(s.project, proposal.patches);
        s.mutate("应用 Agent 演示建议", (target) => Object.assign(target, p));
      },
      undo: () => {
        const s = getState();
        const prev = s.past.at(-1);
        if (!prev) return;
        setState({
          project: prev.project,
          revision: s.revision + 1,
          past: s.past.slice(0, -1),
          future: [{ project: s.project, label: prev.label }, ...s.future],
          lastKey: "",
          saved: false,
        });
      },
      redo: () => {
        const s = getState();
        const next = s.future[0];
        if (!next) return;
        setState({
          project: next.project,
          revision: s.revision + 1,
          future: s.future.slice(1),
          past: [...s.past, { project: s.project, label: next.label }],
          lastKey: "",
          saved: false,
        });
      },
    }),
    {
      name: "taleweft-design-v1",
      version: 2,
      migrate: (persisted) => {
        const state = persisted as Pick<
          StudioState,
          "project" | "revision" | "chapterId" | "selectedId"
        >;
        return { ...state, project: migrateOriginals(state.project) };
      },
      skipHydration: true,
      storage: createJSONStorage(() => ({
        getItem: async (name) => (await get<string>(name)) ?? null,
        setItem: async (name, value) => {
          usePersistence.setState({ status: "saving" });
          try {
            await set(name, value);
            usePersistence.setState({ status: "saved" });
          } catch {
            usePersistence.setState({ status: "error" });
          }
        },
        removeItem: (name) => del(name),
      })),
      partialize: (state) => ({
        project: state.project,
        revision: state.revision,
        chapterId: state.chapterId,
        selectedId: state.selectedId,
      }),
      onRehydrateStorage: () => (_state, error) => {
        useStudio.setState({ ready: true, storageError: !!error });
      },
    },
  ),
);
