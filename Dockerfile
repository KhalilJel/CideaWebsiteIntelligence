FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip git curl \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --break-system-packages --no-cache-dir \
  "https://github.com/Panniantong/Agent-Reach/archive/main.zip"

RUN npm install -g mcporter \
  && mcporter config add exa https://mcp.exa.ai/mcp --scope home \
  && curl https://cursor.com/install -fsS | bash \
  && ln -sf /root/.local/bin/agent /usr/local/bin/agent

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx playwright install --with-deps chromium

CMD ["npm","run","audit:website:intelligence","--","https://cidealeads.com","CideaLead"]
