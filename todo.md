# DefocusApp - TODO

## Schema & Backend
- [x] Schema: tabela `manufacturers` (fabricantes de IOL)
- [x] Schema: tabela `iols` (lentes intraoculares com modelo, fabricante, características)
- [x] Schema: tabela `patients` (pacientes com nome, CPF, nascimento, telefone)
- [x] Schema: tabela `patient_iols` (associação paciente-IOL com alvo refrativo)
- [x] Schema: tabela `measurements` (medições de acuidade visual por data)
- [x] Schema: tabela `measurement_points` (pontos da curva: dioptria, acuidade)
- [x] tRPC: procedures para CRUD de fabricantes
- [x] tRPC: procedures para CRUD de IOLs
- [x] tRPC: procedures para CRUD de pacientes
- [x] tRPC: procedures para CRUD de medições e pontos
- [x] tRPC: procedure para comparação de IOLs (dados agregados)
- [x] tRPC: procedure para alvo refrativo

## Design System & Layout
- [x] Paleta de cores: azul médico, verde, amarelo/ouro
- [x] Tipografia profissional (Inter/Plus Jakarta Sans)
- [x] DashboardLayout com sidebar de navegação
- [x] Rotas: /dashboard, /patients, /iols, /measurements, /compare
- [x] Componente de header com usuário logado

## Módulo de IOLs
- [x] Página de listagem de IOLs com filtros por fabricante
- [x] Modal/formulário de adição de IOL (fabricante, modelo, tipo, características)
- [x] Seed de IOLs populares (Hanita, Rayner, Alcon, Johnson & Johnson)
- [x] Card de IOL com informações visuais

## Módulo de Pacientes
- [x] Página de listagem de pacientes com busca
- [x] Formulário de cadastro de paciente (nome, CPF, nascimento, telefone)
- [x] Página de detalhe do paciente com histórico de medições
- [x] Associação de IOL ao paciente (OD/OS, alvo refrativo)

## Sistema de Medições
- [x] Formulário de registro de medição (data, IOL, olho OD/OS)
- [x] Entrada de pontos da curva de defoque (dioptria, acuidade visual)
- [x] Validação de dados de acuidade visual (0.0 a 1.0)
- [x] Histórico de medições por paciente

## Gráficos e Visualização
- [x] Gráfico de curva de defoque (Recharts LineChart)
- [x] Eixo X: dioptrias (-5.0 a +1.5)
- [x] Eixo Y: acuidade visual (0.0 a 1.0)
- [x] Múltiplas linhas coloridas por IOL/medição
- [x] Legenda interativa
- [x] Tooltip com valores ao hover

## Comparação de IOLs
- [x] Página de comparação com seleção de múltiplos IOLs
- [x] Curvas sobrepostas com cores distintas
- [x] Legenda clara com nome do IOL/fabricante
- [x] Exportar/imprimir gráfico (placeholder - feature futura, toast informativo implementado)

## Alvo Refrativo
- [x] Interface de seleção de alvo refrativo
- [x] Dropdown de fabricante → IOL → valores de refração
- [x] Visualização da curva esperada para o alvo

## Conformidade LGPD/GDPR
- [x] Consentimento de uso de dados no cadastro de paciente
- [x] Dados agregados anonimizados para análise de IOLs
- [x] Política de privacidade acessível

## Testes
- [x] Testes vitest para procedures de IOL
- [x] Testes vitest para procedures de paciente
- [x] Testes vitest para procedures de medição

## Bugs
- [x] Fix: SelectItem com value="" vazio em NewMeasurement.tsx causa crash na página /patients/:id/measurements/new

## Atualização de IOLs (Dataset Expandido)
- [x] Adicionar coluna `aConstant` (decimal) e `isActive` na tabela `iols`
- [x] Limpar dados seed antigos e repopular com lista completa (12 fabricantes, 62 IOLs)
- [x] Dropdown em cascata: fabricante → IOL em PatientDetail (associar IOL ao paciente)
- [x] Dropdown em cascata: fabricante → IOL em NewMeasurement (selecionar IOL da medição)
- [x] Dropdown em cascata: fabricante → IOL na página Compare
- [x] Exibir constante A na ficha da IOL e na comparação

## IOL Detail Sheet (Curvas Reais por IOL)
- [x] Procedure backend: buscar todas as curvas reais associadas a uma IOL específica (por iolId)
- [x] Componente IOLDetailSheet: painel lateral com contador "n", gráfico de curvas sobrepostas e lista de medições
- [x] Integrar click handler na página de IOLs para abrir o sheet
- [x] Exibir badge "n curvas" em cada card de IOL na listagem

## UI Refinements
- [x] Substituir ícone de olho nos cards de IOL pela inicial/abreviação do fabricante com cor de fundo distinta por fabricante

## Bug Fix - Avatares de Fabricante
- [x] Corrigir bug: iniciais mostrando "?" nos cards de IOL (problema no mapeamento de nomes do banco)
- [x] Pesquisar cores oficiais de marca de cada fabricante (Zeiss, Alcon, J&J, Hoya, Rayner, Bausch+Lomb, Hanita, Teleon, PhysIOL, Medicontour, Biotech, Leedsay)
- [x] Aplicar cores corretas e iniciais corretas para cada fabricante

## Bug Fix - manufacturerName null
- [x] Investigar por que algumas IOLs chegam com manufacturerName null no frontend
- [x] Corrigir JOIN ou manufacturer_id nas IOLs sem fabricante associado

## UI Consistency
- [x] Substituir ícone de olho no cabeçalho do IOLDetailSheet pelo avatar colorido do fabricante

## Bug Fix - Rules of Hooks
- [x] Corrigir violação das Regras dos Hooks em DefocusChart (hook chamado após return condicional)

## Curva Defocus - Refatoração Completa
- [x] Substituir todas as ocorrências de "defoque/Defoque" por "Defocus" em todo o projeto
- [x] Backend: função de conversão logMAR (Decimal → logMAR, Snellen → logMAR)
- [x] Backend: interpolação spline cúbica (monotone cubic) para suavizar a curva
- [x] Backend: procedure measurements.defocusCurve que retorna pontos interpolados em logMAR
- [x] Frontend: gráfico com eixo Y em logMAR invertido (0.0 no topo, 1.0 na base)
- [x] Frontend: eixo X de +1.0 D (esquerda) a -4.0 D (direita)
- [x] Frontend: zonas de visão funcionais (Longe/Intermediário/Perto) como bandas de fundo
- [x] Frontend: linha de corte funcional pontilhada em 0.20 logMAR
- [x] Frontend: formulário de nova medição com entrada em Snellen/Decimal/logMAR configurável
- [x] Frontend: stepper rápido para os níveis de defoco fixos (+1.0, +0.5, 0.0, -0.5, ..., -4.0)

## Correção Crítica - Gráfico Defocus
- [x] Eixo Y: logMAR com valores negativos no TOPO (-0.10 a 0.60), sem inversão artificial de escala
- [x] Eixo X: +1.00 à esquerda → -3.50 à direita (positivos primeiro, depois negativos), passos de 0.50
- [x] Curva em forma de sino com pico próximo a 0 D (melhor visão de longe)
- [x] Formulário de entrada: pontos exatos do formulário físico (+1.00, +0.50, 0, -0.50, -1.00, -1.50, -2.00, -2.50, -3.00, -3.50)
- [x] Remover inversão artificial do eixo Y (reversed=true estava causando o erro)
- [x] Distâncias equivalentes no eixo X: ∞ (0D), 100cm (-1D), 50cm (-2D), 33cm (-3D)

## IOLDetailSheet - Correção de Eixos
- [x] Converter visualAcuity decimal para logMAR no IOLDetailSheet
- [x] Eixo Y: logMAR -0.1 (topo) a 0.6 (base) em todos os gráficos
- [x] Eixo X: +1.0 (esquerda) a -3.5 (direita) em todos os gráficos
- [x] Tooltip atualizado para exibir logMAR + Snellen equivalente

## Compare - Correção de Eixos
- [x] Curvas de referência convertidas para logMAR (trifocal, EDOF, monofocal, bifocal, tórica)
- [x] Eixo Y: logMAR -0.1 (topo) a 0.6 (base)
- [x] Eixo X: +1.0 (esquerda) a -3.5 (direita)
- [x] Linhas de referência: 0.20 logMAR (corte funcional) e 0 D (plano)

## Correção Eixo Y - Orientação Clínica
- [x] Eixo Y: -0,1 no TOPO e 0,6 na BASE (interseção com eixo X) em todos os gráficos
- [x] Recharts: usar reversed={true} com domain={[-0.1, 0.6]} para orientação correta
- [x] Aplicar em PatientDetail, IOLDetailSheet, Compare e NewMeasurement

## Bug Fix - Boxes de Acuidade Visual no Formulário
- [x] Boxes devem exibir o valor no formato selecionado (Decimal, Snellen 20/x, logMAR)
- [x] Implementar funções de conversão: decimal→Snellen, decimal→logMAR para exibição
- [x] Valor armazenado internamente sempre em decimal; exibição convertida conforme formato

## Bug Fix - Parser Snellen Formato Concatenado
- [x] Aceitar "2020" como 20/20, "2040" como 20/40, "20200" como 20/200
- [x] Lógica: se número >= 2000, interpretar como 20 + denominador (ex: 2040 → num=20, den=40)
- [x] Manter compatibilidade com formatos existentes: "20/40", "40" (bare denominator)
- [x] 24 testes unitários adicionados para cobrir todos os formatos Snellen

## UX - Campos Select no Formulário de IOL
- [x] Campo "Material": converter de input texto para Select com opções predefinidas (hidrofílico, hidrofóbico, PMMA, silicone, etc.)
- [x] Campo "Design Óptico": converter de input texto para Select com opções predefinidas (difractivo, refrativo, EDOF, etc.)
- [x] Manter compatibilidade com valores já salvos no banco
- [x] Constantes centralizadas em client/src/lib/iolConstants.ts com helpers getMaterialLabel e getOpticDesignLabel

## Bug Fix - Contador Medições Registradas no Dashboard
- [x] Corrigir contador "Medições Registradas" para exibir total global de medições de todos os pacientes

## Bug Fix - NaN nos valores de acuidade visual
- [x] Corrigir spline: pontos duplicados no mesmo diopter causavam NaN na interpolação
- [x] Aplicar média dos pontos duplicados antes de construir o spline (PatientDetail + defocusCurve.ts)
- [x] Dados no banco estão corretos (sem NaN); problema era no processamento client-side

## Bug Fix - Curva OS não aparece no gráfico
- [x] Corrigir: curva OS (verde) não renderiza mesmo com botão OS selecionado
- [x] Causa: router usava getMeasurementsByPatient()[0] que retornava OD em vez da OS recém-criada
- [x] Correção: createMeasurement() agora retorna insertId diretamente, eliminando race condition

## Feature - Editar e Deletar IOL
- [x] Backend: procedure iols.update para editar campos de uma IOL existente
- [x] Backend: procedure iols.delete para remover uma IOL (com verificação de dependências)
- [x] Frontend: botão de editar em cada card de IOL abrindo modal pré-preenchido
- [x] Frontend: botão de deletar com modal de confirmação antes de excluir
- [x] Frontend: invalidar cache após editar/deletar para atualizar a lista

## UX - Botões Editar/Excluir e Ordenação por Frequência
- [x] Corrigir visibilidade dos botões de editar/excluir nos cards de IOL (botões Editar e Excluir explícitos no rodapé de cada card)
- [x] Adicionar ordenação por frequência de uso: IOLs mais usadas pelo médico aparecem primeiro na biblioteca
- [x] Backend: procedure/query para contar uso de cada IOL pelo usuário logado (via patient_iols + patients JOIN)
- [x] Frontend: indicador visual de "mais usada" nos cards de IOL (barra dourada + badge ★ Nx usada)

## Feature - Login e Cadastro com Email/Senha
- [x] Backend: adicionar campos passwordHash e emailVerified à tabela users no schema
- [x] Backend: migration SQL para novos campos (ALTER TABLE users ADD passwordHash, emailVerified)
- [x] Backend: procedure auth.register (nome, email, senha) com hash bcrypt
- [x] Backend: procedure auth.loginEmail (email, senha) que valida hash e cria sessão JWT
- [x] Backend: procedure auth.me já existente continua funcionando
- [x] Frontend: página /login com formulário de login (email + senha) e link para cadastro
- [x] Frontend: página /register com formulário de cadastro (nome, email, senha, confirmação)
- [x] Frontend: validação de formulários (email válido, senha mínimo 8 chars, confirmação igual)
- [x] Frontend: redirecionar usuário não autenticado para /login ao acessar rotas protegidas
- [x] Frontend: botões da landing page redirecionam para /login

## Feature - Isolamento de Dados por Médico (Multi-tenancy)
- [ ] Auditar todas as queries: pacientes, medições, patient_iols, comparações
- [ ] Corrigir getPatientsByUser: já usa userId, confirmar que está correto
- [ ] Corrigir getAllIOLs/getAllIOLsWithUsage: IOLs são globais (catálogo), mas patient_iols são por usuário
- [ ] Corrigir getPatientById: garantir que só retorna paciente do userId autenticado
- [ ] Corrigir getMeasurements: garantir que só retorna medições de pacientes do userId autenticado
- [ ] Corrigir getPatientIols: garantir que só retorna IOLs de pacientes do userId autenticado
- [ ] Corrigir getIOLComparisonData: garantir isolamento por userId
- [ ] Corrigir getIOLCurves: garantir isolamento por userId
- [ ] Backend: todas as procedures de leitura de dados clínicos devem ser protectedProcedure
- [ ] Backend: procedures de escrita devem verificar ownership antes de modificar

## Feature - Dashboard Administrativo
- [ ] Backend: adminProcedure para listar todos os usuários com contagem de pacientes e medições
- [ ] Backend: adminProcedure para ver pacientes e resultados de um usuário específico
- [ ] Backend: adminProcedure para ver estatísticas agregadas por IOL (todos os usuários)
- [ ] Frontend: rota /admin protegida por role=admin
- [ ] Frontend: página /admin com lista de médicos cadastrados e seus stats
- [ ] Frontend: página /admin/users/:id com detalhes do médico (pacientes, medições, IOLs usadas)
- [ ] Frontend: página /admin/iols com ranking de IOLs por desempenho agregado
- [ ] Frontend: sidebar do admin separada do sidebar do médico

## Feature - Recuperação de Senha por E-mail
- [x] Verificar serviço de e-mail: usando Resend API (3.000 e-mails/mês grátis)
- [x] Backend: tabela password_reset_tokens (userId, token, expiresAt, usedAt)
- [x] Backend: migration SQL aplicada
- [x] Backend: procedure auth.requestPasswordReset (email) — gera token, envia e-mail via Resend
- [x] Backend: procedure auth.resetPassword (token, newPassword) — valida token, atualiza senha
- [x] Frontend: página /forgot-password com campo de e-mail e feedback de sucesso
- [x] Frontend: página /reset-password?token=xxx com campos de nova senha e confirmação
- [x] Frontend: link "Esqueci minha senha" na página de login
- [x] Testes: 6 testes cobrindo requestPasswordReset e resetPassword (69 testes no total)

## Feature - Notificação de Novo Cadastro para Admins
- [x] Backend: query adminGetAllAdminEmails para buscar e-mails de todos os usuários com role=admin
- [x] Backend: helper sendNewDoctorNotification (e-mail HTML com dados do novo médico)
- [x] Backend: disparar notificação em auth.register após criação bem-sucedida do usuário
- [x] Backend: notificação assíncrona via setImmediate (não bloqueia o cadastro se e-mail falhar)
- [x] Testes: 4 testes cobrindo todos os cenários de notificação (73 testes no total)
- [x] Testes: verificar que falha no envio de e-mail não impede o cadastro

## Feature - Logo da DefocusApp
- [x] Upload da logo para CDN e obtenção da URL pública
- [x] Inserir logo na sidebar do DashboardLayout (substituindo ícone Activity e texto)
- [x] Inserir logo nas páginas de login, cadastro, forgot-password e reset-password
- [x] Verificar visual em todas as páginas

## Feature - Favicon Personalizado
- [x] Gerar favicon.ico (32x32), favicon-192.png e favicon-512.png a partir da logo
- [x] Configurar tags de favicon no index.html (ico, png 192, png 512, apple-touch-icon)

## Feature - Exportar PDF Curva Defocus
- [x] Backend: Puppeteer para gerar PDF no servidor (server/pdfGenerator.ts)
- [x] Backend: procedure patients.exportPDF retorna PDF como base64
- [x] Logo em base64 embutida no servidor (server/logoBase64.ts) para evitar CORS
- [x] Botão "Exportar PDF" no card de Curva Defocus da página do paciente
- [x] Relatório anonimizado: sem nome do paciente, apenas ID do caso
- [x] Inclui: logo DefocusApp, nome do médico, data/hora, tabela de IOLs, gráfico SVG, aviso LGPD
- [x] PDF verificado: 114KB, 1 página A4, logo e gráfico renderizados corretamente
