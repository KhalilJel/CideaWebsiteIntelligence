FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:/root/.cursor/bin:$PATH"

RUN uv python install 3.12 \
  && git clone --depth 1 https://github.com/browser-use/jev-ultrafast.git /opt/jev \
  && uv sync --project /opt/jev --python 3.12

RUN npm install -g mcporter \
  && mcporter config add exa https://mcp.exa.ai/mcp --scope home \
  && curl https://cursor.com/install -fsS | bash

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx playwright install --with-deps chromium

CMD ["npm","run","audit:website:intelligence","--","https://cidealeads.com","CideaLead"]
