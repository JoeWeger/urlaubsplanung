import { NextResponse, type NextRequest } from "next/server";
import { authToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();
  if (req.nextUrl.pathname === "/login") return NextResponse.next();
  const cookie = req.cookies.get("auth")?.value;
  if (cookie && cookie === (await authToken(pw))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
