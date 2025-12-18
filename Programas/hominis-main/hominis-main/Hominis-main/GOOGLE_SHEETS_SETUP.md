# Configuração Google Sheets API

Para habilitar o login usando o Google Sheets, siga os passos abaixo:

## 1. Criar um Projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Dê um nome ao projeto (ex: "MRS Login System")

## 2. Ativar a Google Sheets API

1. No menu lateral, vá em **APIs e Serviços** > **Biblioteca**
2. Pesquise por "Google Sheets API"
3. Clique em "Google Sheets API" e depois em **Ativar**

## 3. Criar Credenciais (API Key)

1. No menu lateral, vá em **APIs e Serviços** > **Credenciais**
2. Clique em **+ Criar credenciais** no topo
3. Selecione **Chave de API**
4. Copie a chave gerada

## 4. Configurar a Planilha do Google Sheets

1. Abra a planilha: [MRS Login Spreadsheet](https://docs.google.com/spreadsheets/d/1pBV_1zzSG7wy1U9zxQNq7njkwItGJ7mF8aAgYkVMgwQ/edit?gid=0#gid=0)
2. Certifique-se de que a planilha está **pública** (qualquer pessoa com o link pode visualizar)
3. A estrutura deve ser:
   - **Coluna A**: Usuário
   - **Coluna B**: Senha
   - **Linha 1**: Cabeçalho (opcional)
   - **Linhas 2+**: Dados de login

Exemplo:

```
| Usuário  | Senha    |
|----------|----------|
| admin    | admin123 |
| usuario1 | senha123 |
```

## 5. Configurar a API Key no Projeto

1. Abra o arquivo `.env` na raiz do projeto
2. Cole a API Key que você copiou no passo 3:

```env
VITE_GOOGLE_SHEETS_API_KEY=SUA_API_KEY_AQUI
```

3. Salve o arquivo

## 6. Reiniciar o Servidor

Após adicionar a API Key, reinicie o servidor de desenvolvimento para aplicar as mudanças.

## Segurança

⚠️ **IMPORTANTE**:
- Esta é uma solução básica para demonstração
- Para produção, considere usar um sistema de autenticação mais robusto
- Nunca exponha senhas em texto simples
- Configure restrições de API no Google Cloud Console para limitar o uso da chave

## Restrições Recomendadas para a API Key

No Google Cloud Console:

1. Vá em **Credenciais**
2. Clique na API Key criada
3. Em **Restrições de aplicativo**, selecione:
   - **Referenciadores HTTP (sites)** e adicione seus domínios
4. Em **Restrições de API**, selecione:
   - **Restringir chave** e escolha apenas **Google Sheets API**

Isso aumenta a segurança da sua API Key.
