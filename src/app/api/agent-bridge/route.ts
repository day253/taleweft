import { bridgeDirectory, syncEditor } from "@/lib/agent-bridge";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const token = request.headers.get("x-taleweft-connection") || "";
    if (!/^[a-f0-9]{48}$/.test(token))
      return Response.json(
        { error: "缺少有效的编辑器连接标识" },
        { status: 401 },
      );
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin &&
      new URL(request.headers.get("origin")!).host !==
        request.headers.get("host")
    )
      return Response.json({ error: "不允许跨站连接" }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 2_000_000)
      return Response.json({ error: "项目超过同步大小限制" }, { status: 413 });
    const result = await syncEditor(bridgeDirectory(), token, JSON.parse(raw));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "同步失败" },
      { status: 400 },
    );
  }
}
