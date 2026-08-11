# Sandbox for running Grok agents against this repo.
#
# Grok is run with --always-approve, so this container is the only thing standing
# between an autonomous agent and the machine. Keep it minimal and keep the mount
# list short: a git worktree at /workspace, and nothing else from the host except
# the auth volume.
#
# Build:  docker build -t magicwash-grok-sandbox:latest -f .grok/sandbox.Dockerfile .grok
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash dev
USER dev
WORKDIR /home/dev

RUN curl -fsSL https://x.ai/cli/install.sh | bash
ENV PATH="/home/dev/.grok/bin:${PATH}"

WORKDIR /workspace
CMD ["bash"]
