import { NextResponse, type NextRequest } from "next/server";

const legacyExactRoutes = new Set([
  "/client-portal",
  "/clients",
  "/documents",
  "/grants",
  "/listhaus",
  "/login",
  "/lost",
  "/programs",
  "/reports",
  "/resources",
  "/settings",
  "/templates",
  "/work",
]);

const legacyRoutePrefixes = [
  "/clients/",
  "/grants/",
  "/p/",
  "/poster/",
  "/programs/",
  "/resources/",
  "/templates/",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLegacyRoute =
    legacyExactRoutes.has(pathname) ||
    legacyRoutePrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isLegacyRoute) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/records";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/client-portal",
    "/clients/:path*",
    "/documents",
    "/grants/:path*",
    "/listhaus",
    "/login",
    "/lost",
    "/p/:path*",
    "/poster/:path*",
    "/programs/:path*",
    "/reports",
    "/resources/:path*",
    "/settings",
    "/templates/:path*",
    "/work",
  ],
};
