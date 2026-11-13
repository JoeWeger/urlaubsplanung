import { query } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const rows = await query<{ filename: string; mime: string | null; data: Buffer }>(
    "SELECT filename, mime, data FROM flight_files WHERE id=$1",
    [id],
  );
  const file = rows[0];
  if (!file) return new Response("Nicht gefunden", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime || "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
