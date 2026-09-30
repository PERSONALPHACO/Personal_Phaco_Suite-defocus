# Serviço de backup do DefocusApp (cron no Railway).
# Imagem oficial do MySQL: mysqldump/mysql na MESMA versão do servidor (9.4),
# o que evita incompatibilidades de dump e de autenticação (caching_sha2).
FROM mysql:9.4

ARG AGE_VERSION=v1.2.1
ARG RCLONE_VERSION=v1.68.2
RUN set -eux; \
    command -v curl || microdnf install -y curl-minimal; \
    command -v gzip || microdnf install -y gzip; \
    command -v unzip || microdnf install -y unzip; \
    microdnf clean all || true; \
    curl -fsSL -o /tmp/age.tgz "https://github.com/FiloSottile/age/releases/download/${AGE_VERSION}/age-${AGE_VERSION}-linux-amd64.tar.gz"; \
    tar -xzf /tmp/age.tgz -C /tmp; \
    install -m 0755 /tmp/age/age /usr/local/bin/age; \
    rm -rf /tmp/age /tmp/age.tgz; \
    curl -fsSL -o /tmp/rclone.zip "https://downloads.rclone.org/${RCLONE_VERSION}/rclone-${RCLONE_VERSION}-linux-amd64.zip"; \
    unzip -q /tmp/rclone.zip -d /tmp; \
    install -m 0755 /tmp/rclone-${RCLONE_VERSION}-linux-amd64/rclone /usr/local/bin/rclone; \
    rm -rf /tmp/rclone*; \
    age --version; rclone version | head -1

COPY backup.sh /usr/local/bin/backup.sh
# O ENTRYPOINT da imagem mysql inicializaria um servidor — aqui só o script.
ENTRYPOINT []
CMD ["/usr/local/bin/backup.sh"]
