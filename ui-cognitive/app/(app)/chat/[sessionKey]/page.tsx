import { ChatSessionLayout } from "@/components/chat/chat-session-layout";

type ChatPageProps = {
  params: Promise<{ sessionKey: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { sessionKey } = await params;

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ChatSessionLayout sessionKey={sessionKey} />
    </div>
  );
}
