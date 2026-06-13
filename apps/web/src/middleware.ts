import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasValidClerkPublishableKey } from "./app/components/clerk-config";

const isProtectedRoute = createRouteMatcher(["/app(.*)", "/onboarding(.*)"]);

const middleware = hasValidClerkPublishableKey()
  ? clerkMiddleware(async (auth, request) => {
      if (isProtectedRoute(request)) {
        await auth.protect();
      }
    })
  : (request: Request) => {
      const url = new URL(request.url);

      if (url.pathname.startsWith("/app") || url.pathname.startsWith("/onboarding")) {
        return NextResponse.redirect(new URL("/setup", request.url));
      }

      return NextResponse.next();
    };

export default middleware;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
