FROM node:22-slim

RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai

COPY openplugins-token-balance-*.tgz /tmp/
RUN cd /tmp && npm install -g openplugins-token-balance-*.tgz

RUN mkdir -p /root/.config/opencode && \
    echo '{"plugin":["@openplugins/token-balance"]}' > /root/.config/opencode/opencode.json

WORKDIR /root
CMD ["opencode"]
