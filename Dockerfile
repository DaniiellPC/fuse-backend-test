# --- (Build Stage) ---
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* ./

RUN npm ci

COPY . .

RUN npm run build

# --- (Production Stage) ---
FROM node:24-alpine AS production

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/main"]
