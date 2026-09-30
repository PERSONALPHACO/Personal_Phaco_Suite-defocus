# Serviço de backup do DefocusApp (cron no Railway).
# Imagem oficial do MySQL: mysqldump/mysql na MESMA versão do servidor (9.4),
# o que evita incompatibilidades de dump e de autenticação (caching_sha2).
FROM mysql:9.4

ARG AGE_VERSION=v1.2.1
RUN set -eux; \
    command -v curl || microdnf install -y curl-minimal; \
    command -v gzip || microdnf install -y gzip; \
    microdnf clean all || true; \
    curl -fsSL -o /tmp/age.tgz "https://github.com/FiloSottile/age/releases/download/${AGE_VERSION}/age-${AGE_VERSION}-linux-amd64.tar.gz"; \
    tar -xzf /tmp/age.tgz -C /tmp; \
    install -m 0755 /tmp/age/age /usr/local/bin/age; \
    rm -rf /tmp/age /tmp/age.tgz; \
    age --version

COPY backup.sh /usr/local/bin/backup.sh
# O ENTRYPOINT da imagem mysql inicializaria um servidor — aqui só o script.
ENTRYPOINT []
CMD ["/usr/local/bin/backup.sh"]
