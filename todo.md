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
