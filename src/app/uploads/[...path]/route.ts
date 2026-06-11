import { readFile } from "node:fs/promises";
import path from "node:path";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { path: segments } = await context.params;
  const normalizedSegments = segments.filter(
    (segment) => segment && segment !== "." && segment !== "..",
  );

  if (normalizedSegments.length !== segments.length) {
    return new Response("Not Found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "uploads", ...normalizedSegments);

  try {
    const file = await readFile(filePath);
    return new Response(file, { status: 200 });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
