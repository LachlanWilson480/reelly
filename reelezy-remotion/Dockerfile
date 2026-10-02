FROM node:20-slim

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build

ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
