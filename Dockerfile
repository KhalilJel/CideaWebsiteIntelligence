FROM node:20-bookworm-slim
WORKDIR /app

COPY package.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip git curl && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir --break-system-packages https://github.com/Panniantong/agent-reach/archive/main.zip
RUN npm install
RUN npx playwright install --with-deps chromium

COPY . .

CMD ["npm","run","audit:website:intelligence","--","https://cidealeads.com","CideaLead"]
