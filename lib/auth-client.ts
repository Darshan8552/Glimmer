import { createAuthClient } from "better-auth/client";
import { adminClient, emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [adminClient(), emailOTPClient()],
});

export const { signIn, signUp, signOut } = authClient;
