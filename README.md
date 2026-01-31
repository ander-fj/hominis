# Sistema de Gestão RH & SST

Sistema completo e inteligente de gestão de recursos humanos e segurança do trabalho com ranking dinâmico de colaboradores.

## Recursos Principais 
     
### 🎯 Ranking Inteligente
- **Sistema dinâmico e configurável** de avaliação de colaboradores
- **Critérios personalizáveis** com pesos ajustáveis em tempo real
- **Auto-normalização** de pontuações para comparação justa
- **Recálculo automático** ao modificar critérios ou pesos
- **Visualizações interativas** com gráficos e rankings

### 📊 Dashboard RH
- Indicadores de assiduidade, pontualidade e horas trabalhadas
- Distribuição por departamento
- Estatísticas consolidadas
- Interface recolhível para melhor organização
- Cards interativos com tendências

### 🦺 Dashboard SST (Segurança e Saúde do Trabalho)
- Monitoramento de treinamentos e validades
- Controle de EPIs (Equipamentos de Proteção Individual)
- Gestão de exames médicos
- Registro e análise de incidentes
- Taxa de conformidade em tempo real

### 📈 Análise Integrada
- Correlação entre indicadores de RH e SST
- Gráficos de tendência temporal
- Insights automáticos
- Recomendações baseadas em dados
- Filtros por período e departamento

### 🔮 Previsões
- Modelos preditivos configuráveis:
  - Média Móvel
  - Regressão Linear
  - Suavização Exponencial
- Projeções de faltas, acidentes, horas trabalhadas
- Intervalos de confiança
- Cenários otimistas e realistas

### ⚙️ Configurações Avançadas
- **Editor de Critérios Dinâmico**:
  - Adicionar, editar e remover critérios
  - Ajuste de pesos com validação automática (soma = 100%)
  - Auto-ajuste de pesos distribuído
  - Configuração de direção (maior/menor = melhor)
- **Sincronização Google Sheets**
- **Importação/Exportação** XLSX e CSV
- **Botão de recálculo** de rankings
- **Dados de exemplo** para demonstração

## Tecnologias Utilizadas

- **Frontend**: React + TypeScript + Vite
- **Estilização**: Tailwind CSS
- **Ícones**: Lucide React
- **Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth (preparado)

## Estrutura do Banco de Dados

### Tabelas Principais

1. **employees** - Dados dos colaboradores
2. **evaluation_criteria** - Critérios de avaliação configuráveis
3. **employee_scores** - Pontuações individuais por critério
4. **employee_rankings** - Rankings calculados
5. **attendance_records** - Registros de presença
6. **sst_trainings** - Treinamentos de segurança
7. **sst_ppe** - Equipamentos de proteção
8. **sst_medical_exams** - Exames médicos
9. **sst_incidents** - Incidentes de segurança
10. **sheets_sync_config** - Configuração de sincronização

## Como Usar

### 1. Configuração Inicial

Configure as variáveis de ambiente no arquivo `.env`:
```
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

### 2. Inserir Dados de Exemplo

1. Acesse **Configurações**
2. Clique em **Dados de Exemplo**
3. Confirme a inserção
4. Navegue pelas diferentes seções para visualizar os dados

### 3. Configurar Critérios de Avaliação

1. Acesse **Configurações > Critérios de Avaliação**
2. Adicione, edite ou remova critérios
3. Ajuste os pesos (total deve ser 100%)
4. Use **Auto-ajustar Pesos** para distribuição igual
5. Salve as alterações
6. Clique em **Recalcular Ranking** para aplicar

### 4. Visualizar Ranking

1. Acesse **Ranking Inteligente**
2. Filtre por período e departamento
3. Visualize o top 10 colaboradores
4. Veja detalhes e distribuição de pontuações

### 5. Monitorar SST

1. Acesse **SST** no menu
2. Visualize indicadores de segurança
3. Monitore treinamentos vencidos
4. Acompanhe entrega de EPIs
5. Registre e analise incidentes

## Algoritmo de Ranking

O sistema utiliza um algoritmo inteligente de normalização e ponderação:

1. **Coleta de Dados**: Obtém pontuações brutas de cada critério
2. **Normalização**: Converte valores para escala 0-100
   - Para "maior = melhor": `(valor - min) / (max - min) * 100`
   - Para "menor = melhor": `(max - valor) / (max - min) * 100`
3. **Ponderação**: Aplica pesos configurados
4. **Agregação**: Soma ponderada de todos os critérios
5. **Ordenação**: Ranking decrescente por pontuação total

### Auto-Adaptação

- Adição de critério → Recalcula com novo peso
- Alteração de peso → Recalcula todas as pontuações
- Remoção de critério → Redistribui pesos automaticamente

## Funcionalidades de Exportação

- **CSV**: Dados tabulares para Excel
- **JSON**: Backup completo em formato estruturado
- **PDF**: Relatórios formatados (preparado)

## Segurança

- **Row Level Security (RLS)** habilitado em todas as tabelas
- Políticas de acesso por usuário autenticado
- Validação de dados no frontend e backend
- Proteção contra perda de dados acidental

## Design e UX

- Interface moderna e profissional
- Gradientes azul/ciano para elementos principais
- Animações suaves e transições
- Cards responsivos e hover states
- Tooltips informativos
- Hierarquia visual clara
- Design system consistente

## Próximos Passos

- Implementar autenticação completa
- Adicionar notificações em tempo real
- Desenvolver módulo de relatórios avançados
- Integração completa com Google Sheets API
- Dashboard mobile otimizado
- Exportação PDF com gráficos

## Suporte

Sistema desenvolvido com foco em usabilidade, escalabilidade e segurança de dados.
Projeto Hominis
