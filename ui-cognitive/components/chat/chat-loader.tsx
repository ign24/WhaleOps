export const ChatLoader = () => {
  return (
    <div className="loader-wrapper loader-wrapper--bubble" role="status" aria-live="polite" aria-label="Agente pensando respuesta">
      <div className="agent-loader" aria-hidden="true">
        <div className="agent-loader__inner">
          <div className="agent-loader__block" />
          <div className="agent-loader__block" />
          <div className="agent-loader__block" />
          <div className="agent-loader__block" />
          <div className="agent-loader__block" />
          <div className="agent-loader__block" />
          <div className="agent-loader__block" />
          <div className="agent-loader__block" />
        </div>
      </div>
    </div>
  );
};
