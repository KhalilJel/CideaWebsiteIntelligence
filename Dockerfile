FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip git curl \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --break-system-packages --no-cache-dir \
  "https://github.com/Panniantong/Agent-Reach/archive/main.zip"

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx playwright install --with-deps chromium

CMD ["npm","run","audit:website:intelligence","--","https://cidealeads.com","CideaLead"]
