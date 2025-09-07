# 코드 실행 전용 최소 이미지
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ make python3 python3-pip ca-certificates bash coreutils \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# 실행 작업 디렉터리
WORKDIR /work