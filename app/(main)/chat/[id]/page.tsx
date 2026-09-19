"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import ChatThread from "../_components/chat-thread";
import { QueryHttpError } from "@/components/query-provider";
import { conversationKey, fetchConversationDetail } from "@/lib/chat-queries";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const query = useQuery({
    queryKey: conversationKey(id),
    queryFn: () => fetchConversationDetail(id),
  });

  useEffect(() => {
    if (query.error instanceof QueryHttpError && query.error.status === 401) {
      router.push("/signin");
    }
  }, [query.error, router]);

  const unauthorized =
    query.error instanceof QueryHttpError && query.error.status === 401;

  if (unauthorized || !query.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-[18px] font-semibold text-foreground">Conversation not found</h1>
        <p className="text-[13px] text-muted-foreground">
          It may have been deleted or belong to another account.
        </p>
        <Link
          href="/chat"
          className="rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Start a new chat
        </Link>
      </div>
    );
  }

  return (
    <ChatThread
      key={id}
      conversationId={id}
      title={query.data.title}
      initialMessages={query.data.messages}
      initialModel={query.data.model || undefined}
    />
  );
}
