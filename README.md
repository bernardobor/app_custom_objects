# 📦 Gerenciador de Objetos Customizados - Zendesk App

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Framework](https://img.shields.io/badge/Zendesk%20App%20Framework-2.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

Uma aplicação Zendesk moderna e intuitiva para gerenciar e editar registros de Objetos Customizados (Custom Objects) diretamente da barra de navegação lateral do Zendesk Support.

## 🎯 Características Principais

- ✅ **Interface Dinâmica**: Adapta-se automaticamente aos campos de cada objeto customizado
- 📊 **Visualização em Abas**: Gerencia múltiplos objetos customizados em uma única interface
- ✏️ **Edição In-Place**: Edite campos diretamente na tabela com feedback visual
- 📄 **Paginação Inteligente**: Navegue facilmente por grandes conjuntos de dados (até 100 registros por página)
- 🎨 **Design Moderno**: Interface bonita e responsiva com UX otimizada
- 🔄 **Sincronização em Tempo Real**: Atualizações instantâneas via API do Zendesk
- 🛡️ **Tratamento de Erros**: Gerenciamento robusto de erros e limites de taxa

## 📋 Pré-requisitos

- Conta Zendesk com permissões de administrador
- Acesso ao Zendesk Apps para instalar aplicações customizadas
- Objetos Customizados já criados no Zendesk (você precisa saber os API names)

## 🚀 Instalação

### Passo 1: Preparar o Pacote

1. Certifique-se de que todos os arquivos estão na estrutura correta:

```
impotacao_calendario/
├── manifest.json
├── README.md
├── translations/
│   └── en.json
└── assets/
    ├── iframe.html
    ├── app.js
    ├── styles.css
    ├── logo.svg
    ├── logo.png
    └── logo-small.png
```

2. **Comprima os arquivos em um arquivo ZIP**:
   - Selecione todos os arquivos e pastas na raiz do projeto
   - Crie um arquivo ZIP (ex: `gerenciador-objetos-customizados.zip`)
   - **IMPORTANTE**: Os arquivos devem estar na raiz do ZIP, não dentro de uma pasta

### Passo 2: Instalar no Zendesk

1. Acesse o **Admin Center** do Zendesk:
   - Clique no ícone de produtos no canto superior direito
   - Selecione "Admin Center"

2. Navegue até **Apps and integrations** > **Apps** > **Zendesk Support apps**

3. Clique em **Upload private app** (no canto superior direito)

4. Selecione o arquivo ZIP criado no Passo 1

5. Clique em **Upload**

### Passo 3: Configurar a Aplicação

Após o upload, você será direcionado para a página de configuração:

1. **Nome da Aplicação**: O nome já está definido no manifest.json

2. **Objetos Customizados para Exibir**:
   - Este é o campo mais importante!
   - Insira os **API names** dos objetos customizados que deseja gerenciar
   - Separe múltiplos objetos por vírgula ou quebra de linha
   - **Exemplo**: `customer_data, product_inventory, order_history`

   **Como encontrar o API name de um objeto?**
   - Vá em Admin Center > Objects and rules > Custom objects
   - Clique no objeto desejado
   - O API name está na URL ou nas configurações do objeto

3. **Registros por Página** (opcional):
   - Padrão: 50
   - Máximo: 100
   - Define quantos registros serão exibidos por página

4. Clique em **Install** para concluir a instalação

## 💡 Como Usar

### Acessando a Aplicação

1. Após a instalação, abra o Zendesk Support
2. Procure pelo ícone da aplicação na **barra de navegação lateral esquerda**
3. Clique no ícone para abrir o painel do gerenciador

### Navegando pelos Objetos

- **Abas**: Cada aba representa um objeto customizado configurado
- Clique em uma aba para visualizar os registros daquele objeto
- A aplicação carrega automaticamente os campos e dados

### Visualizando Dados

- A tabela exibe todos os campos do objeto customizado
- A primeira coluna sempre mostra o **ID** do registro
- Use os botões de paginação para navegar entre páginas

### Editando Registros

1. **Clique em qualquer célula editável** (exceto a coluna ID)
2. Um campo de entrada aparecerá automaticamente
3. **Tipos de campos suportados**:
   - Texto: Input de texto simples
   - Número: Input numérico
   - Data: Seletor de data
   - Checkbox: Caixa de seleção (Sim/Não)
4. **Para salvar**: Pressione Enter ou clique fora do campo
5. **Para cancelar**: Pressione ESC
6. Um indicador de "Salvando..." aparecerá durante o processo
7. Uma notificação confirmará o sucesso ou erro da operação

### Atualizando Dados

- Clique no botão **🔄 Atualizar** para recarregar os dados do objeto ativo
- Útil para ver mudanças feitas por outros usuários ou sistemas

## 🏗️ Arquitetura da Aplicação

### Estrutura de Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `manifest.json` | Configurações da aplicação Zendesk (localização, parâmetros, metadados) |
| `assets/iframe.html` | Estrutura HTML da interface do usuário |
| `assets/app.js` | Lógica JavaScript principal (API calls, renderização, eventos) |
| `assets/styles.css` | Estilização CSS moderna e responsiva |
| `translations/en.json` | Traduções para internacionalização |

### Fluxo de Funcionamento

```
1. Inicialização
   ├─ Carrega ZAF Client
   ├─ Lê configurações do manifest.json
   └─ Extrai lista de objetos customizados

2. Renderização
   ├─ Cria abas para cada objeto
   ├─ Busca schema (definição de campos) via API
   └─ Busca registros via API

3. Interação do Usuário
   ├─ Clique em aba → Carrega objeto
   ├─ Clique em célula → Modo de edição
   ├─ Salvar → PATCH request para API
   └─ Paginação → Usa cursors da API
```

### Comunicação com a API

A aplicação utiliza a **Zendesk Custom Objects API**:

- **GET** `/api/v2/custom_objects/{object_name}` - Busca schema
- **GET** `/api/v2/custom_objects/{object_name}/records` - Busca registros
- **PATCH** `/api/v2/custom_objects/{object_name}/records/{id}` - Atualiza registro

Todas as chamadas são feitas através do **ZAF Client** (`client.request()`), que:
- Gerencia autenticação automaticamente
- Evita problemas de CORS
- Garante segurança das requisições

## 📚 Conceitos JavaScript Explicados

### 1. Estado da Aplicação (Application State)

```javascript
const appState = {
  client: null,
  customObjects: [],
  activeObjectIndex: 0,
  // ... mais propriedades
};
```

**O que é?** Um objeto que armazena todas as informações da aplicação durante sua execução.

**Por que usar?** Centraliza os dados e facilita o acesso de qualquer função.

### 2. Async/Await

```javascript
async function loadObjectData(index) {
  await loadObjectSchema(objectName);
  await loadObjectRecords(objectName);
}
```

**O que é?** Uma forma moderna de trabalhar com código assíncrono (operações que levam tempo, como chamadas de API).

**Por que usar?** Torna o código mais legível, parecendo código síncrono, mas mantendo a eficiência assíncrona.

### 3. Event Listeners (Ouvintes de Eventos)

```javascript
button.addEventListener('click', () => handleTabClick(index));
```

**O que é?** Código que "escuta" eventos do usuário (cliques, digitação, etc.) e executa funções.

**Por que usar?** Essencial para criar interatividade e responder às ações do usuário.

### 4. DOM Manipulation (Manipulação do DOM)

```javascript
const tab = document.createElement('button');
tab.className = 'tab';
tabsContainer.appendChild(tab);
```

**O que é?** Criação e modificação dinâmica de elementos HTML via JavaScript.

**Por que usar?** Permite criar interfaces dinâmicas que se adaptam aos dados.

### 5. Template Literals

```javascript
const url = `/api/v2/custom_objects/${objectName}/records`;
```

**O que é?** Strings com backticks (\`) que permitem inserir variáveis com `${variavel}`.

**Por que usar?** Facilita a construção de strings complexas, como URLs dinâmicas.

### 6. Array Methods (map, filter, forEach)

```javascript
appState.customObjects.forEach((objectName, index) => {
  // Cria uma aba para cada objeto
});
```

**O que é?** Métodos poderosos para trabalhar com arrays (listas).

**Por que usar?** Código mais limpo e funcional do que loops tradicionais.

### 7. Destructuring

```javascript
const { settings } = metadata;
```

**O que é?** Extrair propriedades de objetos de forma concisa.

**Por que usar?** Código mais limpo e legível.

## 🐛 Solução de Problemas

### A aplicação não aparece na barra de navegação

**Causa**: A localização pode não estar configurada corretamente.

**Solução**:
1. Verifique se o manifest.json tem `"location": { "support": { "nav_bar": {...} } }`
2. Reinstale a aplicação
3. Faça logout e login novamente no Zendesk

### Erro: "Nenhum objeto customizado foi configurado"

**Causa**: O campo de configuração está vazio ou com formato incorreto.

**Solução**:
1. Vá em Admin Center > Apps > Gerenciar aplicações
2. Encontre a aplicação e clique em configurações
3. Preencha corretamente os API names dos objetos
4. Clique em Update

### Erro ao carregar registros

**Causa**: Pode ser um problema de permissões ou objeto não existe.

**Solução**:
1. Verifique se o API name está correto
2. Confirme que você tem permissão para acessar o objeto
3. Abra o console do navegador (F12) para ver erros detalhados

### Rate Limiting (Limite de Taxa)

**Causa**: Muitas requisições em pouco tempo.

**Solução**:
1. Aguarde alguns minutos
2. Evite clicar rapidamente em múltiplos botões
3. A aplicação já tem tratamento para isso, mas em casos extremos, pode ocorrer

## 🔧 Personalização

### Modificar o número máximo de registros

No `manifest.json`, altere o default:

```json
{
  "name": "records_per_page",
  "default": 50  // Altere para até 100
}
```

### Adicionar novos tipos de campos

No `assets/app.js`, na função `createInputForField()`, adicione:

```javascript
case 'dropdown':
  input = document.createElement('select');
  // Adicione as opções
  break;
```

### Customizar cores

No `assets/styles.css`, modifique as variáveis CSS:

```css
:root {
  --primary-color: #1f73b7;  /* Sua cor primária */
  --success-color: #28a745;  /* Sua cor de sucesso */
}
```

## 📖 Recursos de Aprendizado

### Documentação Oficial

- [Zendesk App Framework (ZAF)](https://developer.zendesk.com/documentation/apps/getting-started/using-the-apps-framework/)
- [Custom Objects API](https://developer.zendesk.com/api-reference/ticketing/custom-objects/custom_objects/)
- [JavaScript MDN](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript)

### Tutoriais Recomendados

1. **JavaScript Assíncrono**:
   - [MDN - Async/Await](https://developer.mozilla.org/pt-BR/docs/Learn/JavaScript/Asynchronous/Async_await)
   
2. **Manipulação do DOM**:
   - [MDN - Introduction to the DOM](https://developer.mozilla.org/pt-BR/docs/Web/API/Document_Object_Model/Introduction)

3. **Zendesk Apps**:
   - [Building Your First Zendesk App](https://developer.zendesk.com/documentation/apps/getting-started/building-your-first-app/)

## 🤝 Contribuindo

Sugestões e melhorias são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## 📞 Suporte

- **Email**: support@fundacred.com
- **Documentação**: Este README
- **Issues**: Abra uma issue no repositório

## 🎓 Desenvolvido por

**Fundacred** - Transformando o gerenciamento de dados no Zendesk

---

**Versão**: 1.0.0  
**Última Atualização**: Outubro de 2025

Feito com ❤️ e JavaScript
