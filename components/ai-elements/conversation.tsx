"use client";

import { Button } from "@/components/ui/shadcn-default/button";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback, useRef, useEffect } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn(
      "relative flex-1 overflow-y-auto overscroll-contain",
      className,
    )}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content
    className={cn(
      "flex flex-col gap-16 p-8",
      // Prevent scroll anchoring issues during streaming
      "[overflow-anchor:auto]",
      className,
    )}
    style={{
      // Helps prevent layout shifts during content updates
      contain: "layout style",
    }}
    {...props}
  />
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className,
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn(
          "absolute bottom-16 left-[50%] translate-x-[-50%] rounded-full w-40 h-40 shadow-md border border-gray-200 bg-white hover:bg-gray-50",
          className,
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="w-20 h-20 text-gray-600" />
      </Button>
    )
  );
};

// Message skeleton for loading states
export type MessageSkeletonProps = ComponentProps<"div"> & {
  variant?: "user" | "assistant";
};

export const MessageSkeleton = ({
  className,
  variant = "assistant",
  ...props
}: MessageSkeletonProps) => (
  <div
    className={cn(
      "flex w-full max-w-[80%] gap-8",
      variant === "user" ? "ml-auto justify-end" : "",
      className,
    )}
    {...props}
  >
    <div
      className={cn(
        "flex flex-col gap-8 w-full",
        variant === "user" ? "items-end" : "",
      )}
    >
      {variant === "user" ? (
        <Skeleton className="h-40 w-3/4 rounded-8" />
      ) : (
        <>
          <Skeleton className="h-16 w-full rounded-4" />
          <Skeleton className="h-16 w-5/6 rounded-4" />
          <Skeleton className="h-16 w-4/6 rounded-4" />
        </>
      )}
    </div>
  </div>
);

// Chat skeleton for initial loading
export type ChatSkeletonProps = ComponentProps<"div">;

export const ChatSkeleton = ({ className, ...props }: ChatSkeletonProps) => (
  <div
    className={cn("flex flex-col gap-24 p-16 animate-pulse", className)}
    {...props}
  >
    {/* User message skeleton */}
    <MessageSkeleton variant="user" />

    {/* Assistant message skeleton */}
    <MessageSkeleton variant="assistant" />

    {/* Another user message skeleton */}
    <MessageSkeleton variant="user" />

    {/* Another assistant message skeleton */}
    <MessageSkeleton variant="assistant" />
  </div>
);
