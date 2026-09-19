"use client";

import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlight } from "sugar-high";
import { Sparkle } from "@/components/glimmer-mark";
import CopyButton from "./copy-button";
import MermaidBlock from "./mermaid-block";

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

function CodeBlock({ code, streaming }: { code: string; streaming: boolean }) {
  let html: string | null = null;
  if (!streaming) {
    try {
      html = highlight(code);
    } catch (e) {
      console.warn("chat: highlight failed, using plain text", e instanceof Error ? e.message : e);
      html = null;
    }
  }
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-code">
      {!streaming && (
        <div className="flex justify-end border-b border-border/60 px-2 py-1">
          <CopyButton text={code} />
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-code-foreground">
        {html ? (
          <code dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}

function PreBlock({ children, streaming }: { children: ReactNode; streaming: boolean }) {
  const first = Array.isArray(children) ? children[0] : children;
  let language: string | null = null;
  if (isValidElement<{ className?: string }>(first)) {
    const match = /language-([\w-]+)/.exec(first.props.className ?? "");
    if (match) language = match[1];
  }
  const code = nodeText(children);
  if (language === "mermaid" && !streaming && code.trim().length > 0) {
    return <MermaidBlock chart={code} />;
  }
  return <CodeBlock code={code} streaming={streaming} />;
}

export default function AssistantMessage({
  text,
  streaming,
  toolStatus = null,
}: {
  text: string;
  streaming: boolean;
  toolStatus?: string | null;
}) {
  if (streaming && text.trim().length === 0) {
    return (
      <div className="flex animate-pulse items-center gap-2 py-1 text-muted-foreground">
        <Sparkle size={13} />
        <span className="text-[13px]">
          {toolStatus === "webSearch" ? "Searching the web…" : "Thinking…"}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 mb-2.5 text-[19px] font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2 text-[17px] font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-1.5 text-[15px] font-semibold text-foreground first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-1.5 text-[14px] leading-6 text-foreground first:mt-0 last:mb-0">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-6 text-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1 [&>p]:my-0">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground/40"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded-md bg-code px-1.5 py-0.5 font-mono text-[12.5px] text-code-foreground">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <PreBlock streaming={streaming}>{children}</PreBlock>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 rounded-xl bg-code px-4 py-2 text-[14px] leading-6 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 h-px border-0 bg-border" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-[13px] text-foreground">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-muted px-3 py-2 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/60 px-3 py-2 align-top">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
      {streaming && (
        <span className="ml-0.5 inline-block h-[15px] w-[7px] animate-pulse rounded-[1px] bg-foreground align-[-2px]" />
      )}
    </div>
  );
}
