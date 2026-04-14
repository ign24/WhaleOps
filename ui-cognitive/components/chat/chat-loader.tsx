export const ChatLoader = () => {
  return (
    <div className="loader-wrapper loader-wrapper--bubble" role="status" aria-live="polite" aria-label="Agente pensando respuesta">
      <div className="agent-loader" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
};
