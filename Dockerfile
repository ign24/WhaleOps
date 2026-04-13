FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git curl nodejs npm \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
    | sh -s -- -b /usr/local/bin

RUN curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz \
    | tar xz -C /usr/local/bin gitleaks

RUN npm install -g eslint

RUN pip install --no-cache-dir uv semgrep bandit ruff radon pytest coverage

WORKDIR /app
COPY . .

RUN uv sync --frozen --no-dev

RUN mkdir -p /app/logs /app/traces /app/data /tmp/analysis /app/workspace

ENV TRACES_PATH=/app/traces/agent_traces.jsonl
ENV LOGS_PATH=/app/logs/agent.log
ENV MILVUS_URI=/app/data/milvus_lite.db

EXPOSE 8000

CMD ["uv", "run", "nat", "serve", "--config_file", "src/cognitive_code_agent/configs/config.yml", "--host", "0.0.0.0", "--port", "8000"]
