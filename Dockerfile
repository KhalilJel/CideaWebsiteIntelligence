FROM node:20-bookworm-slim
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

CMD ["npm","run","audit:website:intelligence","--","https://cidealeads.com","CideaLead"]
