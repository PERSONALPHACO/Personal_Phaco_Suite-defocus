# Restaurar um backup do DefocusApp

Os backups ficam no Cloudflare R2 (bucket `defocusapp-backups`), um arquivo por dia:
`defocusapp-AAAAMMDDTHHMMSSZ.sql.gz.age`. Estão cifrados com `age`; só a chave
privada (`defocusapp-backup-chave-privada.txt`, guardada pelo dono) os abre.

```bash
# 1. baixar o arquivo do R2 (painel da Cloudflare → R2 → bucket → Download)
# 2. decifrar e descompactar
age -d -i defocusapp-backup-chave-privada.txt defocusapp-XXXX.sql.gz.age | gunzip > dump.sql
# 3. restaurar num banco (vazio ou novo)
mysql -h HOST -P PORTA -u USUARIO -p NOME_DO_BANCO < dump.sql
```

Sem a chave privada não há restauração. Guarde-a em dois lugares (ex.: gerenciador de
senhas + pendrive/cofre). Não a coloque no Railway nem no GitHub.

Agenda: todo dia às 06:00 UTC (03:00 em Brasília). Retenção: regra de ciclo de vida
do bucket apaga arquivos com mais de 35 dias.
