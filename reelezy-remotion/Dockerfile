FROM node:20-slim

RUN apt-get update && apt-get install -y \
  ffmpeg \
  chromium \
  libnspr4 \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  fonts-liberation \
  fontconfig \
  && fc-cache -f -v \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build

ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
