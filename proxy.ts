import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const publicRoutes = ["/", "/signin", "/signup", "/verify-otp", "/forgot-password", "/reset-password"];

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (publicRoutes.some((route) => pathname === route)) {
		return NextResponse.next();
	}

	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return NextResponse.redirect(new URL("/signin", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/chat/:path*", "/((?!api|_next|static|.*\\..*).*)"],
};