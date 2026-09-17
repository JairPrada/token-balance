FROM node:22-slim

RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*
RUN npm install -g opencode-ai

RUN mkdir -p /root/.config/opencode /root/.local/share/opencode && \
    printf '{"model":"deepseek/deepseek-chat"}' > /root/.config/opencode/opencode.json && \
    printf '{"deepseek":{"type":"api","key":"sk-dummy-for-testing"}}' > /root/.local/share/opencode/auth.json

WORKDIR /app
CMD ["bash"]
