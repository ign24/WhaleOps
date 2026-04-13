export default function ChatLoading() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-4">
      <div className="neu-raised h-28 animate-pulse" />
      <div className="neu-inset min-h-0 animate-pulse" />
      <div className="neu-raised h-32 animate-pulse" />
    </div>
  );
}
