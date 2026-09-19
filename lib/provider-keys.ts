import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { providerKey } from "./db/schema";

export const SUPPORTED_PROVIDERS = ["openrouter", "groq"] as const;

export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(value: unknown): value is SupportedProvider {
  return (
    typeof value === "string" &&
    (SUPPORTED_PROVIDERS as readonly string[]).includes(value)
  );
}

const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  key: string;
  expiresAt: number;
}

// ponytail: per-instance in-memory cache, unbounded growth capped by user base;
// miss always falls back to DB so correctness never depends on it.
const keyCache = new Map<string, CacheEntry>();

function cacheKey(userId: string, provider: SupportedProvider) {
  return `${userId}:${provider}`;
}

function encryptionKey(): Buffer {
  const raw = process.env.PROVIDER_KEYS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("PROVIDER_KEYS_ENCRYPTION_KEY is not set in .env.local");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("PROVIDER_KEYS_ENCRYPTION_KEY must be 32 bytes as hex (64 chars)");
  }
  return key;
}

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptApiKey(packed: string): string {
  const [ivHex, tagHex, dataHex] = packed.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Malformed encrypted key");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskApiKey(plaintext: string): string {
  const tail = plaintext.slice(-4);
  return `••••${tail}`;
}

export async function getUserProviderMeta(
  userId: string,
  provider: SupportedProvider
): Promise<{ masked: string; length: number } | null> {
  const key = await getUserProviderKey(userId, provider);
  return key ? { masked: maskApiKey(key), length: key.length } : null;
}

export async function getUserProviderKey(
  userId: string,
  provider: SupportedProvider
): Promise<string | null> {
  const ck = cacheKey(userId, provider);
  const cached = keyCache.get(ck);
  if (cached && cached.expiresAt > Date.now()) return cached.key;
  keyCache.delete(ck);

  const [row] = await db
    .select({ encryptedKey: providerKey.encryptedKey })
    .from(providerKey)
    .where(and(eq(providerKey.userId, userId), eq(providerKey.provider, provider)))
    .limit(1);
  if (!row) return null;

  const key = decryptApiKey(row.encryptedKey);
  keyCache.set(ck, { key, expiresAt: Date.now() + CACHE_TTL_MS });
  return key;
}

export async function getUserProviderMasked(
  userId: string,
  provider: SupportedProvider
): Promise<string | null> {
  const key = await getUserProviderKey(userId, provider);
  return key ? maskApiKey(key) : null;
}

export async function saveUserProviderKey(
  userId: string,
  provider: SupportedProvider,
  plaintext: string
): Promise<void> {
  const encryptedKey = encryptApiKey(plaintext);
  const [existing] = await db
    .select({ id: providerKey.id })
    .from(providerKey)
    .where(and(eq(providerKey.userId, userId), eq(providerKey.provider, provider)))
    .limit(1);
  if (existing) {
    await db
      .update(providerKey)
      .set({ encryptedKey, updatedAt: new Date() })
      .where(eq(providerKey.id, existing.id));
  } else {
    await db.insert(providerKey).values({ userId, provider, encryptedKey });
  }
  keyCache.delete(cacheKey(userId, provider));
}

export async function deleteUserProviderKey(
  userId: string,
  provider: SupportedProvider
): Promise<void> {
  await db
    .delete(providerKey)
    .where(and(eq(providerKey.userId, userId), eq(providerKey.provider, provider)));
  keyCache.delete(cacheKey(userId, provider));
}
