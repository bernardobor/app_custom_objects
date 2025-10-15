// ============================================
// GERENCIADOR DE OBJETOS CUSTOMIZADOS - ZENDESK
// ============================================

/**
 * Este é o arquivo principal da aplicação.
 * Ele gerencia toda a lógica de comunicação com a API do Zendesk,
 * renderização dinâmica da interface e manipulação de dados.
 */

// ============================================
// VARIÁVEIS GLOBAIS E ESTADO DA APLICAÇÃO
// ============================================

/**
 * Estado Global da Aplicação
 * Armazena todas as informações necessárias durante a execução
 */
const appState = {
  client: null,                    // Cliente ZAF (Zendesk App Framework)
  customObjects: [],               // Array com os nomes dos objetos customizados configurados
  activeObjectIndex: 0,            // Índice do objeto atualmente selecionado
  currentPage: 1,                  // Página atual
  recordsPerPage: 50,              // Registros por página (padrão: 50, máximo: 100)
  currentCursor: null,             // Cursor para paginação (fornecido pela API)
  nextCursor: null,                // Cursor para a próxima página
  prevCursor: null,                // Cursor para a página anterior
  cursors: {},                     // Histórico de cursores por página
  objectSchemas: {},               // Schemas (definições de campos) de cada objeto
  objectRecords: {},               // Registros de cada objeto
  allObjectRecords: {},            // TODOS os registros de cada objeto (para busca completa)
  filteredRecords: {},             // Registros filtrados pela pesquisa
  searchTerm: '',                  // Termo de pesquisa atual
  isLoading: false,                // Flag para indicar se está carregando
  isLoadingAllRecords: false,      // Flag para indicar se está carregando todos os registros
  allRecordsLoaded: {}             // Flag para indicar se todos os registros já foram carregados
};

// ============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================

/**
 * Função principal que inicia a aplicação
 * É executada quando o documento HTML termina de carregar
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 Iniciando aplicação Zendesk...');
    
    // Verifica se o ZAFClient está disponível
    if (typeof ZAFClient === 'undefined') {
      throw new Error('ZAFClient não está disponível. Verifique se o SDK do Zendesk foi carregado corretamente.');
    }
    
    // Inicializa o cliente ZAF
    // O ZAF Client é fornecido pelo Zendesk e permite interagir com a API
    appState.client = ZAFClient.init();
    
    // Aguarda um momento para garantir que o DOM está pronto
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Redimensiona o iframe de forma segura
    await safeResize({ width: '100%', height: '600px' });
    
    // Busca as configurações do manifest.json
    const settings = await appState.client.metadata();
    console.log('⚙️ Configurações carregadas:', settings);
    
    // Extrai a lista de objetos customizados da configuração
    await loadCustomObjectsList(settings);
    
    // Se não houver objetos configurados, mostra erro
    if (appState.customObjects.length === 0) {
      throw new Error('Nenhum objeto customizado foi configurado. Por favor, configure os objetos no painel de administração do app.');
    }
    
    // Configura o número de registros por página
    appState.recordsPerPage = settings.settings.records_per_page || 50;
    
    // Limita a 100 registros (máximo da API)
    if (appState.recordsPerPage > 100) {
      appState.recordsPerPage = 100;
    }
    
    console.log(`📊 Exibindo ${appState.recordsPerPage} registros por página`);
    
    // Renderiza as abas (uma para cada objeto customizado)
    renderTabs();
    
    // Carrega os dados do primeiro objeto
    await loadObjectData(0);
    
    // Oculta o loading e mostra o conteúdo principal
    hideLoading();
    showMainContent();
    
    // Configura os event listeners (ouvintes de eventos)
    setupEventListeners();
    
    // Adiciona listener para redimensionamento da janela
    window.addEventListener('resize', debounce(() => {
      try {
        checkHorizontalScroll();
      } catch (error) {
        console.warn('⚠️ Erro ao verificar scroll durante resize:', error);
      }
    }, 250));
    
    console.log('✅ Aplicação inicializada com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar aplicação:', error);
    showError(error.message);
  }
});

// ============================================
// FUNÇÕES DE CONFIGURAÇÃO
// ============================================

/**
 * Carrega a lista de objetos customizados da configuração
 * @param {Object} metadata - Metadados do app (inclui settings)
 */
async function loadCustomObjectsList(metadata) {
  try {
    // Pega o valor da configuração 'custom_objects_to_display'
    const objectsString = metadata.settings.custom_objects_to_display || '';
    
    console.log('📋 String de objetos recebida:', objectsString);
    
    // Divide a string por vírgula ou quebra de linha e remove espaços
    // Exemplo: "object_a, object_b" vira ["object_a", "object_b"]
    appState.customObjects = objectsString
      .split(/[,\n]/)              // Divide por vírgula ou quebra de linha
      .map(obj => obj.trim())      // Remove espaços em branco
      .filter(obj => obj.length > 0); // Remove strings vazias
    
    console.log('📦 Objetos customizados a serem exibidos:', appState.customObjects);
    
  } catch (error) {
    console.error('❌ Erro ao carregar lista de objetos:', error);
    throw new Error('Não foi possível carregar a lista de objetos customizados.');
  }
}

// ============================================
// FUNÇÕES DE RENDERIZAÇÃO DA INTERFACE
// ============================================

/**
 * Renderiza as abas (tabs) para cada objeto customizado
 * Cada aba representa um objeto diferente
 */
function renderTabs() {
  const tabsContainer = document.getElementById('tabs');
  tabsContainer.innerHTML = ''; // Limpa conteúdo anterior
  
  // Para cada objeto customizado, cria uma aba
  appState.customObjects.forEach((objectName, index) => {
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.textContent = formatObjectName(objectName); // Formata o nome para exibição
    tab.dataset.index = index; // Armazena o índice no atributo data
    
    // Marca a primeira aba como ativa
    if (index === 0) {
      tab.classList.add('active');
    }
    
    // Adiciona evento de clique na aba
    tab.addEventListener('click', () => handleTabClick(index));
    
    tabsContainer.appendChild(tab);
  });
}

/**
 * Formata o nome do objeto para exibição
 * Exemplo: "customer_info" vira "Customer Info"
 * @param {string} objectName - Nome do objeto (API name)
 * @returns {string} Nome formatado
 */
function formatObjectName(objectName) {
  return objectName
    .split('_')                          // Divide por underscore
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitaliza cada palavra
    .join(' ');                          // Junta com espaço
}

/**
 * Renderiza a tabela de dados com os registros do objeto ativo
 */
function renderTable() {
  const activeObject = appState.customObjects[appState.activeObjectIndex];
  const schema = appState.objectSchemas[activeObject];
  
  // Usa registros filtrados se houver pesquisa, senão usa todos os registros
  const allRecords = appState.objectRecords[activeObject] || [];
  const records = appState.searchTerm ? 
    (appState.filteredRecords[activeObject] || []) : 
    allRecords;
  
  console.log(`📊 Renderizando tabela para ${activeObject}`);
  console.log(`   Schema:`, schema);
  console.log(`   Registros totais:`, allRecords.length);
  console.log(`   Registros exibidos:`, records.length);
  console.log(`   Termo de pesquisa:`, appState.searchTerm || 'nenhum');
  console.log(`   Campos no schema:`, schema?.custom_object_fields?.length || 0);
  
  // Verifica se o schema foi carregado corretamente
  if (!schema) {
    console.error(`❌ Schema não encontrado para ${activeObject}`);
    showToast(`Erro: Schema não carregado para ${activeObject}`, 'error');
    return;
  }
  
  // Verifica se o schema tem campos
  if (!schema.custom_object_fields || schema.custom_object_fields.length === 0) {
    console.warn(`⚠️ Nenhum campo encontrado no schema de ${activeObject}`);
    showToast(`Aviso: Objeto ${activeObject} não possui campos customizados`, 'warning');
  }
  
  // Renderiza os cabeçalhos da tabela (colunas)
  renderTableHeaders(schema);
  
  // Renderiza o corpo da tabela (linhas com dados)
  renderTableBody(schema, records);
  
  // Atualiza os controles de paginação
  updatePagination();
  
  // Verifica se há scroll horizontal (com proteção)
  try {
    checkHorizontalScroll();
  } catch (error) {
    console.warn('⚠️ Erro ao verificar scroll horizontal:', error);
  }
  
  // Mostra mensagem se não houver dados
  const noDataElement = document.getElementById('no-data');
  if (noDataElement) {
    if (records.length === 0) {
      noDataElement.style.display = 'block';
      // Mensagem personalizada se houver pesquisa ativa
      if (appState.searchTerm) {
        noDataElement.innerHTML = '<p>🔍 Nenhum registro encontrado para a pesquisa.</p>';
      } else {
        noDataElement.innerHTML = '<p>📋 Nenhum registro encontrado.</p>';
      }
    } else {
      noDataElement.style.display = 'none';
    }
  }
}

/**
 * Renderiza os cabeçalhos da tabela baseado no schema do objeto
 * @param {Object} schema - Schema do objeto (definição de campos)
 */
function renderTableHeaders(schema) {
  const thead = document.getElementById('table-head');
  
  // Proteção: verifica se o elemento existe
  if (!thead) {
    console.error('❌ Elemento table-head não encontrado no DOM');
    return;
  }
  
  thead.innerHTML = '';
  
  const headerRow = document.createElement('tr');
  
  // Primeiro cabeçalho: Name do registro
  const nameHeader = document.createElement('th');
  nameHeader.textContent = 'Nome';
  nameHeader.style.width = '200px';
  nameHeader.style.fontWeight = '600';
  headerRow.appendChild(nameHeader);
  
  // Para cada campo do schema, cria um cabeçalho
  if (schema && schema.custom_object_fields) {
    console.log(`   Criando ${schema.custom_object_fields.length} cabeçalhos de colunas`);
    schema.custom_object_fields.forEach((field, index) => {
      console.log(`      Campo ${index + 1}: ${field.key} (${field.type}) - "${field.title}"`);
      const th = document.createElement('th');
      th.textContent = field.title || field.key;
      th.dataset.fieldKey = field.key;
      headerRow.appendChild(th);
    });
  } else {
    console.warn(`   ⚠️ Schema não possui custom_object_fields`);
  }
  
  thead.appendChild(headerRow);
}

/**
 * Renderiza o corpo da tabela com os registros
 * @param {Object} schema - Schema do objeto
 * @param {Array} records - Array de registros
 */
function renderTableBody(schema, records) {
  const tbody = document.getElementById('table-body');
  
  // Proteção: verifica se o elemento existe
  if (!tbody) {
    console.error('❌ Elemento table-body não encontrado no DOM');
    return;
  }
  
  tbody.innerHTML = '';
  
  // Para cada registro, cria uma linha
  records.forEach(record => {
    const row = document.createElement('tr');
    row.dataset.recordId = record.id;
    
    // Coluna do Name (não editável)
    const nameCell = document.createElement('td');
    nameCell.textContent = record.name || record.id || '-';
    nameCell.style.fontWeight = '600';
    nameCell.style.color = '#1f73b7';
    nameCell.title = `ID: ${record.id}`; // Mostra o ID no tooltip
    row.appendChild(nameCell);
    
    // Para cada campo do schema, cria uma célula
    if (schema && schema.custom_object_fields) {
      schema.custom_object_fields.forEach(field => {
        const td = document.createElement('td');
        td.className = 'editable-cell';
        td.dataset.fieldKey = field.key;
        td.dataset.fieldType = field.type;
        
        // Pega o valor do campo (RAW - sem formatação)
        const rawValue = record.custom_object_fields?.[field.key];
        
        // Armazena o valor RAW original no dataset para comparação futura
        // Isso permite verificar se houve mudança real antes de salvar
        if (rawValue !== null && rawValue !== undefined) {
          td.dataset.originalValue = JSON.stringify(rawValue);
        } else {
          td.dataset.originalValue = 'null';
        }
        
        // Exibe o valor formatado
        const displayValue = rawValue !== null && rawValue !== undefined ? rawValue : '-';
        td.textContent = formatFieldValue(displayValue, field.type, field);
        
        // Adiciona evento de clique para edição
        td.addEventListener('click', () => handleCellClick(td, record.id, field));
        
        row.appendChild(td);
      });
    }
    
    tbody.appendChild(row);
  });
}

/**
 * Formata o valor do campo para exibição
 * @param {*} value - Valor do campo
 * @param {string} type - Tipo do campo
 * @param {Object} field - Definição do campo (opcional, para dropdowns/multiselect)
 * @returns {string} Valor formatado
 */
function formatFieldValue(value, type, field = null) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  
  switch (type) {
    case 'date':
      return new Date(value).toLocaleDateString('pt-BR');
    case 'checkbox':
      return value ? '✓ Sim' : '✗ Não';
    case 'dropdown':
      // Para dropdown, mostra o nome da opção em vez do valor
      if (field && field.custom_field_options) {
        const option = field.custom_field_options.find(opt => 
          String(opt.value) === String(value)
        );
        return option ? (option.name || option.value) : String(value);
      }
      return String(value);
    case 'multiselect':
      // Para multiselect, mostra os nomes das opções separados por vírgula
      if (!Array.isArray(value)) {
        return value ? String(value) : '-';
      }
      
      if (value.length === 0) {
        return '-';
      }
      
      if (field && field.custom_field_options) {
        const labels = value.map(val => {
          const option = field.custom_field_options.find(opt => 
            String(opt.value) === String(val)
          );
          return option ? (option.name || option.value) : String(val);
        });
        return labels.join(', ');
      }
      
      return value.join(', ');
    default:
      return String(value);
  }
}

/**
 * Atualiza os controles de paginação
 */
function updatePagination() {
  const pageInfo = document.getElementById('page-info');
  const prevButton = document.getElementById('prev-page');
  const nextButton = document.getElementById('next-page');
  
  // Proteção: verifica se os elementos existem
  if (!pageInfo || !prevButton || !nextButton) {
    console.warn('⚠️ Elementos de paginação não encontrados no DOM');
    return;
  }
  
  // Atualiza o texto da página
  pageInfo.textContent = `Página ${appState.currentPage}`;
  
  // Habilita/desabilita botões baseado nos cursors disponíveis
  prevButton.disabled = appState.currentPage === 1;
  nextButton.disabled = !appState.nextCursor;
}

/**
 * Verifica se a tabela tem scroll horizontal e adiciona indicador visual
 */
function checkHorizontalScroll() {
  const tableContainer = document.getElementById('table-container');
  const table = document.getElementById('data-table');
  
  // Proteção: verifica se os elementos existem antes de acessar propriedades
  if (!tableContainer || !table) {
    console.warn('⚠️ Elementos de tabela não encontrados para verificar scroll');
    return;
  }
  
  // Verifica se o conteúdo da tabela é maior que o container
  const hasScroll = table.scrollWidth > tableContainer.clientWidth;
  
  if (hasScroll) {
    tableContainer.classList.add('has-scroll');
    console.log(`   ℹ️ Tabela tem scroll horizontal (${table.scrollWidth}px > ${tableContainer.clientWidth}px)`);
  } else {
    tableContainer.classList.remove('has-scroll');
  }
  
  // Adiciona listener para remover o indicador quando rolar até o final
  tableContainer.addEventListener('scroll', () => {
    // Verifica novamente se os elementos ainda existem
    if (!tableContainer || !table) return;
    
    const scrolledToEnd = tableContainer.scrollLeft + tableContainer.clientWidth >= table.scrollWidth - 5;
    
    if (scrolledToEnd) {
      tableContainer.classList.remove('has-scroll');
    } else if (hasScroll) {
      tableContainer.classList.add('has-scroll');
    }
  });
}

// ============================================
// FUNÇÕES DE MANIPULAÇÃO DE EVENTOS
// ============================================

/**
 * Configura todos os event listeners da aplicação
 */
function setupEventListeners() {
  // Botão de criar novo registro
  document.getElementById('create-button').addEventListener('click', openCreateModal);
  
  // Botão de atualizar
  document.getElementById('refresh-button').addEventListener('click', handleRefresh);
  
  // Botões de paginação
  document.getElementById('prev-page').addEventListener('click', handlePrevPage);
  document.getElementById('next-page').addEventListener('click', handleNextPage);
  
  // Botão de tentar novamente (no erro)
  document.getElementById('retry-button').addEventListener('click', () => {
    location.reload();
  });
  
  // Modal de criação
  document.getElementById('close-modal').addEventListener('click', closeCreateModal);
  document.getElementById('cancel-create').addEventListener('click', closeCreateModal);
  document.getElementById('modal-overlay').addEventListener('click', closeCreateModal);
  document.getElementById('save-create').addEventListener('click', handleCreateRecord);
  
  // Campo de pesquisa
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  
  searchInput.disabled = false; // Habilita o campo de pesquisa
  searchInput.addEventListener('input', debounce(handleSearch, 800));
  
  // Mostra/esconde botão de limpar baseado no conteúdo
  searchInput.addEventListener('input', () => {
    if (searchInput.value.length > 0) {
      clearSearchBtn.style.display = 'block';
    } else {
      clearSearchBtn.style.display = 'none';
    }
  });
  
  // Limpa pesquisa ao clicar no botão X
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    handleSearch({ target: searchInput });
    searchInput.focus();
  });
  
  // Limpa pesquisa ao pressionar ESC
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      handleSearch({ target: searchInput });
    }
  });
}

/**
 * Manipula o clique em uma aba
 * @param {number} index - Índice da aba clicada
 */
async function handleTabClick(index) {
  if (appState.isLoading || index === appState.activeObjectIndex) {
    return; // Não faz nada se já está na aba ou está carregando
  }
  
  // Atualiza a aba ativa visualmente
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => tab.classList.remove('active'));
  tabs[index].classList.add('active');
  
  // Atualiza o índice ativo
  appState.activeObjectIndex = index;
  
  // Reseta a paginação
  appState.currentPage = 1;
  appState.currentCursor = null;
  appState.nextCursor = null;
  appState.prevCursor = null;
  appState.cursors = {};
  
  // Limpa a pesquisa ao trocar de aba
  appState.searchTerm = '';
  document.getElementById('search-input').value = '';
  
  // Carrega os dados do objeto selecionado
  await loadObjectData(index);
}

/**
 * Manipula a pesquisa/filtro de registros
 * AGORA PROCURA EM TODAS AS PÁGINAS, NÃO APENAS NA PÁGINA ATUAL!
 * @param {Event} event - Evento de input
 */
async function handleSearch(event) {
  const searchTerm = event.target.value.toLowerCase().trim();
  const activeObject = appState.customObjects[appState.activeObjectIndex];
  
  console.log(`🔍 Pesquisando por: "${searchTerm}"`);
  
  // Atualiza o termo de pesquisa no estado
  appState.searchTerm = searchTerm;
  
  // Se não há termo de pesquisa, limpa o filtro
  if (!searchTerm) {
    appState.filteredRecords[activeObject] = [];
    renderTable();
    console.log(`   Pesquisa limpa, exibindo página atual`);
    return;
  }
  
  try {
    // Mostra feedback visual que está carregando
    const searchInput = document.getElementById('search-input');
    const originalPlaceholder = searchInput.placeholder;
    searchInput.placeholder = '🔄 Buscando em todas as páginas...';
    searchInput.disabled = true;
    
    // Carrega TODOS os registros de todas as páginas
    const allRecords = await loadAllObjectRecords(activeObject);
    
    console.log(`   🔍 Pesquisando em ${allRecords.length} registros totais...`);
    
    // Filtra os registros
    const filtered = allRecords.filter(record => {
      // Pesquisa no nome do registro
      if (record.name && record.name.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // Pesquisa no ID
      if (record.id && String(record.id).toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // Pesquisa em todos os campos customizados
      if (record.custom_object_fields) {
        const values = Object.values(record.custom_object_fields);
        return values.some(value => {
          if (value === null || value === undefined) return false;
          
          // Se for array (multiselect), procura em cada item
          if (Array.isArray(value)) {
            return value.some(v => String(v).toLowerCase().includes(searchTerm));
          }
          
          return String(value).toLowerCase().includes(searchTerm);
        });
      }
      
      return false;
    });
    
    // Armazena os registros filtrados
    appState.filteredRecords[activeObject] = filtered;
    
    console.log(`   ✅ Encontrados ${filtered.length} de ${allRecords.length} registros`);
    
    // Restaura o campo de busca
    searchInput.placeholder = originalPlaceholder;
    searchInput.disabled = false;
    
    // Renderiza a tabela com os resultados filtrados
    renderTable();
    
    // Mostra mensagem de feedback
    if (filtered.length === 0) {
      showToast(`Nenhum resultado encontrado para "${searchTerm}" em ${allRecords.length} registros`, 'info');
    } else {
      showToast(`${filtered.length} registro(s) encontrado(s) em ${allRecords.length} registros totais`, 'success');
    }
    
  } catch (error) {
    console.error('❌ Erro ao realizar busca:', error);
    
    // Restaura o campo de busca
    const searchInput = document.getElementById('search-input');
    searchInput.placeholder = 'Buscar registros...';
    searchInput.disabled = false;
    
    showToast(`Erro ao buscar: ${error.message}`, 'error');
    
    // Em caso de erro, faz busca apenas nos registros da página atual
    const currentPageRecords = appState.objectRecords[activeObject] || [];
    const filtered = currentPageRecords.filter(record => {
      if (record.name && record.name.toLowerCase().includes(searchTerm)) return true;
      if (record.id && String(record.id).toLowerCase().includes(searchTerm)) return true;
      if (record.custom_object_fields) {
        const values = Object.values(record.custom_object_fields);
        return values.some(value => {
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchTerm);
        });
      }
      return false;
    });
    
    appState.filteredRecords[activeObject] = filtered;
    renderTable();
  }
}

/**
 * Manipula o clique em uma célula para edição
 * @param {HTMLElement} cell - Elemento da célula
 * @param {string} recordId - ID do registro
 * @param {Object} field - Definição do campo
 */
function handleCellClick(cell, recordId, field) {
  if (cell.classList.contains('editing') || cell.classList.contains('saving')) {
    return; // Já está editando ou salvando
  }
  
  const currentValue = cell.textContent;
  
  // Marca a célula como em edição
  cell.classList.add('editing');
  
  // Cria o input apropriado baseado no tipo do campo
  const input = createInputForField(field, currentValue);
  
  // Substitui o conteúdo da célula pelo input
  cell.innerHTML = '';
  cell.appendChild(input);
  
  // Adiciona hint de cancelamento (exceto para multiselect que tem botão)
  if (field.type !== 'multiselect') {
    const hint = document.createElement('small');
    hint.className = 'edit-hint';
    hint.textContent = 'ESC para cancelar';
    hint.style.display = 'block';
    hint.style.marginTop = '4px';
    hint.style.fontSize = '11px';
    hint.style.color = '#6c757d';
    hint.style.fontStyle = 'italic';
    cell.appendChild(hint);
  }
  
  input.focus();
  
  // Manipula o salvamento ao sair do campo ou pressionar Enter
  const handleSave = async () => {
    const newValue = getInputValue(input, field.type);
    
    // Pega o valor original RAW armazenado no dataset
    let originalValue;
    try {
      const storedValue = cell.dataset.originalValue;
      originalValue = storedValue === 'null' ? null : JSON.parse(storedValue);
    } catch {
      originalValue = null;
    }
    
    // Compara o novo valor com o valor original (otimização!)
    // Evita chamadas desnecessárias à API se o valor não mudou
    if (valuesAreEqual(originalValue, newValue, field.type)) {
      console.log(`   ⏭️ Valor não mudou, cancelando edição (campo: ${field.key})`);
      cell.classList.remove('editing');
      cell.textContent = currentValue;
      return;
    }
    
    console.log(`   🔄 Valor mudou! Original: ${JSON.stringify(originalValue)} → Novo: ${JSON.stringify(newValue)}`);
    
    // Salva o novo valor
    await saveFieldValue(recordId, field.key, newValue, cell, field);
  };
  
  // Para multiselect, adiciona contador e botões de aplicar e cancelar
  if (field.type === 'multiselect') {
    // Contador de selecionados
    const counter = document.createElement('div');
    counter.className = 'multiselect-counter';
    counter.style.marginTop = '4px';
    counter.style.fontSize = '12px';
    counter.style.color = '#6c757d';
    counter.style.fontStyle = 'italic';
    
    const updateCounter = () => {
      const checked = input.querySelectorAll('.multiselect-checkbox:checked').length;
      const total = input.querySelectorAll('.multiselect-checkbox').length;
      counter.textContent = `${checked} de ${total} selecionado(s)`;
    };
    
    // Atualiza contador ao marcar/desmarcar
    const checkboxes = input.querySelectorAll('.multiselect-checkbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', updateCounter);
    });
    
    updateCounter();
    input.appendChild(counter);
    
    // Container de botões
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'multiselect-buttons';
    buttonContainer.style.marginTop = '8px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '4px';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '✕ Cancelar';
    cancelButton.className = 'btn btn-secondary btn-sm';
    cancelButton.style.flex = '1';
    
    cancelButton.addEventListener('click', (e) => {
      e.stopPropagation();
      cell.classList.remove('editing');
      cell.textContent = currentValue;
    });
    
    const applyButton = document.createElement('button');
    applyButton.textContent = '✓ Aplicar';
    applyButton.className = 'btn btn-primary btn-sm multiselect-apply';
    applyButton.style.flex = '1';
    
    applyButton.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSave();
    });
    
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(applyButton);
    input.appendChild(buttonContainer);
  }
  
  // Para dropdowns, salva automaticamente ao mudar a seleção
  if (field.type === 'dropdown') {
    input.addEventListener('change', handleSave);
  }
  
  // Evento ao perder o foco (não se aplica a multiselect que tem botão)
  if (field.type !== 'multiselect') {
    input.addEventListener('blur', handleSave);
  }
  
  // Evento ao pressionar Enter (não se aplica a select ou multiselect)
  if (field.type !== 'dropdown' && field.type !== 'multiselect') {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        input.blur(); // Dispara o evento blur
      }
    });
  }
  
  // Evento ao pressionar Escape (cancela)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cell.classList.remove('editing');
      cell.textContent = currentValue;
    }
  });
}

/**
 * Cria o input apropriado para o tipo de campo
 * @param {Object} field - Definição do campo
 * @param {string} currentValue - Valor atual
 * @returns {HTMLElement} Elemento de input
 */
function createInputForField(field, currentValue) {
  let input;
  
  // Remove formatação do valor atual
  const rawValue = currentValue === '-' ? '' : currentValue;
  
  switch (field.type) {
    case 'checkbox':
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = rawValue.includes('✓') || rawValue === 'true';
      break;
      
    case 'date':
      input = document.createElement('input');
      input.type = 'date';
      if (rawValue && rawValue !== '-') {
        // Converte data do formato brasileiro para ISO
        const dateParts = rawValue.split('/');
        if (dateParts.length === 3) {
          input.value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }
      }
      break;
      
    case 'integer':
    case 'decimal':
      input = document.createElement('input');
      input.type = 'number';
      input.value = rawValue;
      if (field.type === 'decimal') {
        input.step = '0.01';
      }
      break;
      
    case 'dropdown':
      input = document.createElement('select');
      input.className = 'form-select';
      
      // Adiciona opção vazia
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = '-- Selecione --';
      input.appendChild(emptyOption);
      
      // Adiciona as opções do dropdown
      if (field.custom_field_options && field.custom_field_options.length > 0) {
        field.custom_field_options.forEach(option => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.name || option.value;
          
          // Marca a opção atual como selecionada
          if (String(option.value) === String(rawValue) || option.name === rawValue) {
            opt.selected = true;
          }
          
          input.appendChild(opt);
        });
      } else {
        console.warn('Campo dropdown sem opções:', field.key);
      }
      break;
      
    case 'multiselect':
      // Cria um container para as checkboxes de multiseleção
      input = document.createElement('div');
      input.className = 'multiselect-container';
      input.dataset.fieldKey = field.key;
      
      // Converte o valor atual para array se necessário
      let selectedValues = [];
      if (rawValue && rawValue !== '-') {
        if (Array.isArray(rawValue)) {
          selectedValues = rawValue;
        } else if (typeof rawValue === 'string') {
          // Se for string, tenta parsear como array ou split por vírgula
          try {
            selectedValues = JSON.parse(rawValue);
          } catch {
            selectedValues = rawValue.split(',').map(v => v.trim());
          }
        }
      }
      
      // Adiciona as opções como checkboxes
      if (field.custom_field_options && field.custom_field_options.length > 0) {
        field.custom_field_options.forEach(option => {
          const checkboxWrapper = document.createElement('label');
          checkboxWrapper.className = 'multiselect-option';
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = option.value;
          checkbox.className = 'multiselect-checkbox';
          
          // Marca como checked se estiver nos valores selecionados
          if (selectedValues.some(val => String(val) === String(option.value))) {
            checkbox.checked = true;
          }
          
          const label = document.createElement('span');
          label.textContent = option.name || option.value;
          
          checkboxWrapper.appendChild(checkbox);
          checkboxWrapper.appendChild(label);
          input.appendChild(checkboxWrapper);
        });
      } else {
        console.warn('Campo multiselect sem opções:', field.key);
        input.textContent = 'Sem opções disponíveis';
      }
      break;
      
    case 'textarea':
      input = document.createElement('textarea');
      input.value = rawValue;
      input.style.minHeight = '60px';
      input.style.resize = 'vertical';
      break;
      
    case 'text':
    default:
      input = document.createElement('input');
      input.type = 'text';
      input.value = rawValue;
      break;
  }
  
  return input;
}

/**
 * Compara dois valores para verificar se são iguais
 * Considera diferentes tipos de dados (string, number, boolean, array, etc.)
 * @param {*} value1 - Primeiro valor
 * @param {*} value2 - Segundo valor
 * @param {string} fieldType - Tipo do campo (para tratamento específico)
 * @returns {boolean} true se os valores são iguais, false caso contrário
 */
function valuesAreEqual(value1, value2, fieldType) {
  // Se ambos são null/undefined, são iguais
  if ((value1 === null || value1 === undefined) && (value2 === null || value2 === undefined)) {
    return true;
  }
  
  // Se apenas um é null/undefined, são diferentes
  if ((value1 === null || value1 === undefined) || (value2 === null || value2 === undefined)) {
    return false;
  }
  
  // Para arrays (multiselect)
  if (Array.isArray(value1) && Array.isArray(value2)) {
    // Compara tamanho
    if (value1.length !== value2.length) {
      return false;
    }
    
    // Ordena e compara elemento por elemento
    const sorted1 = [...value1].sort();
    const sorted2 = [...value2].sort();
    
    return sorted1.every((val, index) => String(val) === String(sorted2[index]));
  }
  
  // Se um é array e outro não, são diferentes
  if (Array.isArray(value1) || Array.isArray(value2)) {
    return false;
  }
  
  // Para números (integer, decimal)
  if (fieldType === 'integer' || fieldType === 'decimal') {
    const num1 = parseFloat(value1);
    const num2 = parseFloat(value2);
    
    // Se ambos são NaN, considera iguais (ambos vazios)
    if (isNaN(num1) && isNaN(num2)) {
      return true;
    }
    
    return num1 === num2;
  }
  
  // Para boolean (checkbox)
  if (fieldType === 'checkbox') {
    return Boolean(value1) === Boolean(value2);
  }
  
  // Para strings vazias vs null (tratamento especial)
  if ((value1 === '' || value1 === '-') && (value2 === '' || value2 === '-' || value2 === null)) {
    return true;
  }
  
  // Comparação padrão (converte para string)
  return String(value1) === String(value2);
}

/**
 * Obtém o valor do input baseado no tipo
 * @param {HTMLElement} input - Elemento de input
 * @param {string} type - Tipo do campo
 * @returns {*} Valor do input
 */
function getInputValue(input, type) {
  switch (type) {
    case 'checkbox':
      return input.checked;
    case 'integer':
      return parseInt(input.value, 10) || 0;
    case 'decimal':
      return parseFloat(input.value) || 0;
    case 'dropdown':
      return input.value; // Para select, input.value já retorna a opção selecionada
    case 'multiselect':
      // Para multiselect, retorna array com valores selecionados
      const checkboxes = input.querySelectorAll('.multiselect-checkbox:checked');
      return Array.from(checkboxes).map(cb => cb.value);
    case 'textarea':
      return input.value;
    default:
      return input.value;
  }
}

/**
 * Abre o modal para criar novo registro
 */
function openCreateModal() {
  const activeObject = appState.customObjects[appState.activeObjectIndex];
  const schema = appState.objectSchemas[activeObject];
  
  if (!schema || !schema.custom_object_fields) {
    showToast('Erro: Schema não carregado', 'error');
    return;
  }
  
  console.log('➕ Abrindo modal para criar registro em', activeObject);
  
  // Limpa o formulário
  document.getElementById('record-name').value = '';
  document.getElementById('dynamic-fields').innerHTML = '';
  
  // Gera campos dinâmicos baseados no schema
  generateFormFields(schema);
  
  // Exibe o modal
  document.getElementById('create-modal').style.display = 'flex';
  document.getElementById('record-name').focus();
}

/**
 * Fecha o modal de criação
 */
function closeCreateModal() {
  document.getElementById('create-modal').style.display = 'none';
  
  // Limpa o formulário
  document.getElementById('record-name').value = '';
  document.getElementById('dynamic-fields').innerHTML = '';
}

/**
 * Gera os campos do formulário dinamicamente baseado no schema
 * @param {Object} schema - Schema do objeto
 */
function generateFormFields(schema) {
  const container = document.getElementById('dynamic-fields');
  
  schema.custom_object_fields.forEach(field => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    // Label
    const label = document.createElement('label');
    label.setAttribute('for', `field-${field.key}`);
    label.textContent = field.title || field.key;
    if (field.required) {
      label.textContent += ' *';
    }
    formGroup.appendChild(label);
    
    // Input baseado no tipo
    let input;
    
    switch (field.type) {
      case 'checkbox':
        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'form-checkbox-label';
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'form-checkbox';
        input.id = `field-${field.key}`;
        input.dataset.fieldKey = field.key;
        checkboxLabel.appendChild(input);
        checkboxLabel.appendChild(document.createTextNode(' ' + (field.description || 'Marcar')));
        formGroup.appendChild(checkboxLabel);
        break;
        
      case 'date':
        input = document.createElement('input');
        input.type = 'date';
        input.className = 'form-input';
        input.id = `field-${field.key}`;
        input.dataset.fieldKey = field.key;
        if (field.required) input.required = true;
        formGroup.appendChild(input);
        break;
        
      case 'integer':
      case 'decimal':
        input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-input';
        input.id = `field-${field.key}`;
        input.dataset.fieldKey = field.key;
        if (field.type === 'decimal') input.step = '0.01';
        if (field.required) input.required = true;
        input.placeholder = `Digite ${field.title || field.key}`;
        formGroup.appendChild(input);
        break;
        
      case 'textarea':
        input = document.createElement('textarea');
        input.className = 'form-textarea';
        input.id = `field-${field.key}`;
        input.dataset.fieldKey = field.key;
        if (field.required) input.required = true;
        input.placeholder = `Digite ${field.title || field.key}`;
        formGroup.appendChild(input);
        break;
        
      case 'dropdown':
        input = document.createElement('select');
        input.className = 'form-select';
        input.id = `field-${field.key}`;
        input.dataset.fieldKey = field.key;
        if (field.required) input.required = true;
        
        // Opção vazia
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Selecione uma opção';
        input.appendChild(emptyOption);
        
        // Opções do dropdown (se disponível)
        if (field.custom_field_options) {
          field.custom_field_options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.name;
            input.appendChild(opt);
          });
        }
        formGroup.appendChild(input);
        break;
        
      case 'multiselect':
        input = document.createElement('div');
        input.className = 'multiselect-container';
        input.id = `field-${field.key}`;
        input.dataset.fieldKey = field.key;
        
        // Adiciona as opções como checkboxes
        if (field.custom_field_options) {
          field.custom_field_options.forEach(option => {
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.className = 'multiselect-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = option.value;
            checkbox.className = 'multiselect-checkbox';
            
            const labelText = document.createElement('span');
            labelText.textContent = option.name || option.value;
            
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(labelText);
            input.appendChild(checkboxWrapper);
          });
        }
        formGroup.appendChild(input);
        break;
        
      default: // text
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-input';
        input.id = `field-${field.key}`;
        input.dataset.fieldKey = field.key;
        if (field.required) input.required = true;
        input.placeholder = `Digite ${field.title || field.key}`;
        formGroup.appendChild(input);
        break;
    }
    
    // Descrição/Ajuda
    if (field.description && field.type !== 'checkbox') {
      const help = document.createElement('small');
      help.className = 'form-help';
      help.textContent = field.description;
      formGroup.appendChild(help);
    }
    
    container.appendChild(formGroup);
  });
}

/**
 * Manipula a criação de novo registro
 */
async function handleCreateRecord() {
  const activeObject = appState.customObjects[appState.activeObjectIndex];
  const recordName = document.getElementById('record-name').value.trim();
  
  // Validação do nome
  if (!recordName) {
    showToast('Por favor, preencha o nome do registro', 'error');
    document.getElementById('record-name').focus();
    return;
  }
  
  // Coleta os valores dos campos
  const customFields = {};
  const fieldInputs = document.querySelectorAll('[data-field-key]');
  
  fieldInputs.forEach(input => {
    const fieldKey = input.dataset.fieldKey;
    let value;
    
    if (input.type === 'checkbox') {
      value = input.checked;
    } else if (input.type === 'number') {
      value = input.value ? parseFloat(input.value) : null;
    } else if (input.classList.contains('multiselect-container')) {
      // Para multiselect, coleta todos os checkboxes marcados
      const checkboxes = input.querySelectorAll('.multiselect-checkbox:checked');
      value = Array.from(checkboxes).map(cb => cb.value);
    } else {
      value = input.value || null;
    }
    
    customFields[fieldKey] = value;
  });
  
  // Monta o payload
  const payload = {
    custom_object_record: {
      name: recordName,
      custom_object_fields: customFields
    }
  };
  
  console.log('💾 Criando novo registro:', payload);
  
  try {
    // Desabilita o botão de salvar
    const saveButton = document.getElementById('save-create');
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="icon">⏳</span> Criando...';
    
    // Faz a requisição POST para criar o registro
    const response = await appState.client.request({
      url: `/api/v2/custom_objects/${activeObject}/records`,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(payload)
    });
    
    console.log('✅ Registro criado com sucesso:', response);
    
    // Fecha o modal
    closeCreateModal();
    
    // Limpa o cache de todos os registros para forçar recarregamento
    appState.allRecordsLoaded[activeObject] = false;
    appState.allObjectRecords[activeObject] = null;
    
    // Recarrega os dados
    await loadObjectData(appState.activeObjectIndex, true);
    
    // Mostra mensagem de sucesso
    showToast(`Registro "${recordName}" criado com sucesso!`, 'success');
    
  } catch (error) {
    console.error('❌ Erro ao criar registro:', error);
    showToast(`Erro ao criar registro: ${error.message || 'Erro desconhecido'}`, 'error');
    
    // Reabilita o botão
    const saveButton = document.getElementById('save-create');
    saveButton.disabled = false;
    saveButton.innerHTML = '<span class="icon">💾</span> Criar Registro';
  }
}

/**
 * Manipula o botão de atualizar
 */
async function handleRefresh() {
  console.log('🔄 Atualizando dados...');
  
  const activeObject = appState.customObjects[appState.activeObjectIndex];
  
  // Limpa o cache de todos os registros para forçar recarregamento
  appState.allRecordsLoaded[activeObject] = false;
  appState.allObjectRecords[activeObject] = null;
  
  await loadObjectData(appState.activeObjectIndex, true);
  showToast('Dados atualizados com sucesso!', 'success');
}

/**
 * Manipula o botão de página anterior
 */
async function handlePrevPage() {
  if (appState.currentPage > 1) {
    appState.currentPage--;
    const cursor = appState.cursors[appState.currentPage];
    await loadObjectRecords(appState.customObjects[appState.activeObjectIndex], cursor);
    renderTable();
  }
}

/**
 * Manipula o botão de próxima página
 */
async function handleNextPage() {
  if (appState.nextCursor) {
    appState.currentPage++;
    appState.cursors[appState.currentPage] = appState.nextCursor;
    await loadObjectRecords(appState.customObjects[appState.activeObjectIndex], appState.nextCursor);
    renderTable();
  }
}

// ============================================
// FUNÇÕES DE COMUNICAÇÃO COM A API
// ============================================

/**
 * Carrega todos os dados de um objeto (schema + registros)
 * @param {number} index - Índice do objeto
 * @param {boolean} forceReload - Força recarregar mesmo se já estiver em cache
 */
async function loadObjectData(index, forceReload = false) {
  const objectName = appState.customObjects[index];
  
  try {
    console.log(`📥 Carregando dados para ${objectName}...`);
    
    // Se não temos o schema ou forçamos reload, busca o schema
    if (!appState.objectSchemas[objectName] || forceReload) {
      await loadObjectSchema(objectName);
    }
    
    // Se não temos os registros ou forçamos reload, busca os registros
    if (!appState.objectRecords[objectName] || forceReload) {
      await loadObjectRecords(objectName);
    }
    
    // Renderiza a tabela
    renderTable();
    
    console.log(`✅ Dados carregados para ${objectName}`);
    
  } catch (error) {
    console.error(`❌ Erro ao carregar dados de ${objectName}:`, error);
    showToast(`Erro ao carregar dados: ${error.message}`, 'error');
  }
}

/**
 * Busca o schema (definição de campos) de um objeto customizado
 * @param {string} objectName - Nome do objeto (API name)
 */
async function loadObjectSchema(objectName) {
  try {
    console.log(`📋 Buscando schema para ${objectName}...`);
    
    // Primeiro busca as informações do objeto
    const objectResponse = await appState.client.request({
      url: `/api/v2/custom_objects/${objectName}`,
      type: 'GET'
    });
    
    console.log(`   Resposta do objeto:`, objectResponse);
    
    // Agora busca os campos do objeto customizado
    const fieldsResponse = await appState.client.request({
      url: `/api/v2/custom_objects/${objectName}/fields`,
      type: 'GET'
    });
    
    console.log(`   Resposta dos campos:`, fieldsResponse);
    
    // Monta o schema combinando as informações
    const schema = objectResponse.custom_object || objectResponse;
    
    // Adiciona os campos ao schema
    if (fieldsResponse.custom_object_fields) {
      schema.custom_object_fields = fieldsResponse.custom_object_fields;
    }
    
    // Armazena o schema no estado
    appState.objectSchemas[objectName] = schema;
    
    console.log(`✅ Schema completo carregado para ${objectName}:`, schema);
    console.log(`   Total de campos: ${schema.custom_object_fields?.length || 0}`);
    
  } catch (error) {
    console.error(`❌ Erro ao buscar schema de ${objectName}:`, error);
    console.error(`   Detalhes do erro:`, error.responseJSON || error.responseText);
    throw new Error(`Não foi possível carregar a definição de campos do objeto ${objectName}.`);
  }
}

/**
 * Busca os registros de um objeto customizado
 * @param {string} objectName - Nome do objeto (API name)
 * @param {string} cursor - Cursor para paginação (opcional)
 */
async function loadObjectRecords(objectName, cursor = null) {
  try {
    console.log(`📦 Buscando registros para ${objectName}...`);
    
    // Monta a URL com o cursor se fornecido
    let url = `/api/v2/custom_objects/${objectName}/records?page[size]=${appState.recordsPerPage}`;
    
    if (cursor) {
      url += `&page[after]=${cursor}`;
    }
    
    // Faz a requisição para a API do Zendesk
    const response = await appState.client.request({
      url: url,
      type: 'GET'
    });
    
    // Armazena os registros no estado
    appState.objectRecords[objectName] = response.custom_object_records || [];
    
    // Atualiza os cursors de paginação
    if (response.meta && response.meta.has_more) {
      appState.nextCursor = response.meta.after_cursor;
    } else {
      appState.nextCursor = null;
    }
    
    console.log(`✅ ${response.custom_object_records?.length || 0} registros carregados para ${objectName}`);
    
  } catch (error) {
    console.error(`❌ Erro ao buscar registros de ${objectName}:`, error);
    throw new Error(`Não foi possível carregar os registros do objeto ${objectName}.`);
  }
}

/**
 * Carrega TODOS os registros de um objeto customizado (todas as páginas)
 * Esta função é usada para permitir busca completa em todos os registros
 * @param {string} objectName - Nome do objeto (API name)
 * @returns {Array} Array com todos os registros
 */
async function loadAllObjectRecords(objectName) {
  try {
    console.log(`🔍 Carregando TODOS os registros de ${objectName} para busca completa...`);
    
    // Se já carregamos todos os registros antes, retorna do cache
    if (appState.allRecordsLoaded[objectName] && appState.allObjectRecords[objectName]) {
      console.log(`   ✅ Usando cache: ${appState.allObjectRecords[objectName].length} registros`);
      return appState.allObjectRecords[objectName];
    }
    
    // Marca que está carregando
    appState.isLoadingAllRecords = true;
    
    // Array para armazenar todos os registros
    let allRecords = [];
    let cursor = null;
    let pageCount = 0;
    let hasMore = true;
    
    // Loop para carregar todas as páginas
    while (hasMore) {
      pageCount++;
      
      // Monta a URL com o cursor se fornecido
      let url = `/api/v2/custom_objects/${objectName}/records?page[size]=100`;
      
      if (cursor) {
        url += `&page[after]=${cursor}`;
      }
      
      console.log(`   📄 Carregando página ${pageCount}...`);
      
      // Faz a requisição para a API do Zendesk
      const response = await appState.client.request({
        url: url,
        type: 'GET'
      });
      
      // Adiciona os registros desta página ao array total
      const records = response.custom_object_records || [];
      allRecords = allRecords.concat(records);
      
      console.log(`      ✓ ${records.length} registros carregados (total: ${allRecords.length})`);
      
      // Verifica se há mais páginas
      if (response.meta && response.meta.has_more) {
        cursor = response.meta.after_cursor;
        hasMore = true;
      } else {
        hasMore = false;
      }
    }
    
    // Armazena todos os registros no cache
    appState.allObjectRecords[objectName] = allRecords;
    appState.allRecordsLoaded[objectName] = true;
    appState.isLoadingAllRecords = false;
    
    console.log(`✅ Total de ${allRecords.length} registros carregados de ${objectName} em ${pageCount} página(s)`);
    
    return allRecords;
    
  } catch (error) {
    console.error(`❌ Erro ao buscar todos os registros de ${objectName}:`, error);
    appState.isLoadingAllRecords = false;
    throw new Error(`Não foi possível carregar todos os registros do objeto ${objectName}.`);
  }
}

/**
 * Salva o valor de um campo editado
 * @param {string} recordId - ID do registro
 * @param {string} fieldKey - Chave do campo
 * @param {*} newValue - Novo valor
 * @param {HTMLElement} cell - Elemento da célula
 * @param {Object} field - Definição do campo (para formatação correta)
 */
async function saveFieldValue(recordId, fieldKey, newValue, cell, field) {
  const objectName = appState.customObjects[appState.activeObjectIndex];
  
  try {
    console.log(`💾 Salvando campo ${fieldKey} do registro ${recordId}...`);
    console.log(`   Valor anterior: ${cell.textContent}`);
    console.log(`   Novo valor: ${newValue}`);
    
    // Marca a célula como salvando
    cell.classList.remove('editing');
    cell.classList.add('saving');
    cell.textContent = '⏳ Salvando...';
    
    // Monta o payload (corpo da requisição)
    const payload = {
      custom_object_record: {
        custom_object_fields: {
          [fieldKey]: newValue
        }
      }
    };
    
    // Envia a requisição PATCH para atualizar o registro
    const response = await appState.client.request({
      url: `/api/v2/custom_objects/${objectName}/records/${recordId}`,
      type: 'PATCH',
      contentType: 'application/json',
      data: JSON.stringify(payload)
    });
    
    // Remove o estado de salvando
    cell.classList.remove('saving');
    
    // Atualiza o valor exibido usando a função de formatação
    const fieldType = cell.dataset.fieldType;
    cell.textContent = formatFieldValue(newValue, fieldType, field);
    
    // IMPORTANTE: Atualiza o valor original no dataset para futuras comparações
    // Isso garante que a próxima edição terá o valor correto para comparar
    if (newValue !== null && newValue !== undefined) {
      cell.dataset.originalValue = JSON.stringify(newValue);
    } else {
      cell.dataset.originalValue = 'null';
    }
    
    // Atualiza o registro no cache
    const records = appState.objectRecords[objectName];
    const recordIndex = records.findIndex(r => r.id === recordId);
    if (recordIndex !== -1) {
      records[recordIndex].custom_object_fields[fieldKey] = newValue;
    }
    
    console.log(`✅ Campo ${fieldKey} salvo com sucesso!`);
    
    // Limpa o cache de todos os registros para garantir consistência em buscas futuras
    appState.allRecordsLoaded[objectName] = false;
    if (appState.allObjectRecords[objectName]) {
      // Atualiza o registro no cache de todos os registros também
      const allRecords = appState.allObjectRecords[objectName];
      const allRecordIndex = allRecords.findIndex(r => r.id === recordId);
      if (allRecordIndex !== -1) {
        allRecords[allRecordIndex].custom_object_fields[fieldKey] = newValue;
      }
    }
    
    showToast('Campo atualizado com sucesso!', 'success');
    
  } catch (error) {
    console.error(`❌ Erro ao salvar campo ${fieldKey}:`, error);
    
    // Remove o estado de salvando e restaura o valor anterior
    cell.classList.remove('saving');
    cell.classList.add('editable-cell');
    
    // Recarrega os dados para garantir consistência
    await loadObjectData(appState.activeObjectIndex, true);
    
    showToast(`Erro ao salvar: ${error.message}`, 'error');
  }
}

// ============================================
// FUNÇÕES DE UI (INTERFACE)
// ============================================

/**
 * Exibe uma mensagem toast (notificação temporária)
 * @param {string} message - Mensagem a exibir
 * @param {string} type - Tipo da mensagem (success, error, warning, info)
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  // Remove a mensagem após 3 segundos
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * Oculta o loading inicial
 */
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

/**
 * Exibe o conteúdo principal
 */
function showMainContent() {
  document.getElementById('main-content').style.display = 'block';
}

/**
 * Exibe uma mensagem de erro
 * @param {string} message - Mensagem de erro
 */
function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'flex';
  document.getElementById('error-message').textContent = message;
}

// ============================================
// UTILITÁRIOS E HELPERS
// ============================================

/**
 * Redimensiona o iframe do app de forma segura
 * Evita erros quando o DOM não está completamente pronto
 * @param {Object} dimensions - Dimensões do iframe (width, height)
 */
async function safeResize(dimensions = { width: '100%', height: '600px' }) {
  if (!appState.client) {
    console.warn('⚠️ Cliente ZAF não inicializado para resize');
    return;
  }
  
  try {
    // Aguarda um pouco para garantir que o DOM está estável
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Tenta redimensionar
    await appState.client.invoke('resize', dimensions);
  } catch (error) {
    console.warn('⚠️ Erro ao redimensionar iframe:', error);
    // Não lança erro, apenas registra no console
  }
}

/**
 * Debounce - Limita a frequência de execução de uma função
 * Útil para evitar chamadas excessivas à API durante pesquisas
 * @param {Function} func - Função a ser executada
 * @param {number} wait - Tempo de espera em milissegundos
 * @returns {Function} Função com debounce aplicado
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============================================
// LOG FINAL
// ============================================

console.log('📄 app.js carregado com sucesso!');

