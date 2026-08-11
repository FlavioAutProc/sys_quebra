(function() {
    'use strict';

    // ===== CONSTANTES =====
    const DB_NAME = 'QuebrasDB';
    const DB_VERSION = 4; // incrementado para incluir store de produtos
    const STORE_REGISTROS = 'registros';
    const STORE_RELATORIOS = 'relatoriosSalvos';
    const STORE_PRODUTOS = 'produtos';

    let db = null;
    let currentEditId = null;
    let currentViewId = null;
    let currentFotoBase64 = null;
    let currentEditFotoBase64 = null;

    // ===== ABRIR INDEXEDDB =====
    function abrirDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (ev) => {
                const db = ev.target.result;
                // Store registros
                if (!db.objectStoreNames.contains(STORE_REGISTROS)) {
                    const store = db.createObjectStore(STORE_REGISTROS, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('dataHora', 'dataHora', { unique: false });
                    store.createIndex('codigo', 'codigo', { unique: false });
                    store.createIndex('produto', 'produto', { unique: false });
                }
                // Store relatórios
                if (!db.objectStoreNames.contains(STORE_RELATORIOS)) {
                    const storeRel = db.createObjectStore(STORE_RELATORIOS, { keyPath: 'id', autoIncrement: true });
                    storeRel.createIndex('periodoChave', 'periodoChave', { unique: true });
                    storeRel.createIndex('geradoEm', 'geradoEm', { unique: false });
                }
                // Store produtos
                if (!db.objectStoreNames.contains(STORE_PRODUTOS)) {
                    const storeProd = db.createObjectStore(STORE_PRODUTOS, { keyPath: 'codigo' });
                    storeProd.createIndex('nome', 'nome', { unique: false });
                }
            };
            request.onsuccess = (ev) => {
                db = ev.target.result;
                resolve(db);
            };
            request.onerror = (ev) => {
                reject(ev.target.error);
            };
        });
    }

    // ===== HELPERS =====
    function formatDate(d) {
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }

    function formatTime(d) {
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }

    function formatDateTime(d) {
        return `${formatDate(d)} às ${formatTime(d)}`;
    }

    function formatMoeda(valor) {
        return 'R$ ' + valor.toFixed(2).replace('.', ',');
    }

    function formatPeso(kg) {
        return kg.toFixed(3).replace('.', ',') + ' kg';
    }

    function gerarIdDisplay(id) {
        return '#' + String(id).padStart(6, '0');
    }

    function parseFloatBR(str) {
        return parseFloat(str.replace(',', '.')) || 0;
    }

    function valorParaInput(valor) {
        return valor.toFixed(2).replace('.', ',');
    }

    function pesoParaInput(kg) {
        return kg.toFixed(3).replace('.', ',');
    }

    // ===== OPERAÇÕES PRODUTOS =====
    function adicionarProduto(codigo, nome) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_PRODUTOS, 'readwrite');
            const store = tx.objectStore(STORE_PRODUTOS);
            const request = store.add({ codigo: String(codigo), nome: String(nome) });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function obterTodosProdutos() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_PRODUTOS, 'readonly');
            const store = tx.objectStore(STORE_PRODUTOS);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function obterProdutoPorCodigo(codigo) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_PRODUTOS, 'readonly');
            const store = tx.objectStore(STORE_PRODUTOS);
            const request = store.get(String(codigo));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function atualizarProduto(codigo, novoNome) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_PRODUTOS, 'readwrite');
            const store = tx.objectStore(STORE_PRODUTOS);
            const request = store.put({ codigo: String(codigo), nome: String(novoNome) });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function excluirProduto(codigo) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_PRODUTOS, 'readwrite');
            const store = tx.objectStore(STORE_PRODUTOS);
            const request = store.delete(String(codigo));
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ===== OPERAÇÕES REGISTROS =====
    function adicionarRegistro(registro) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_REGISTROS, 'readwrite');
            const store = tx.objectStore(STORE_REGISTROS);
            const request = store.add(registro);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function obterTodosRegistros() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_REGISTROS, 'readonly');
            const store = tx.objectStore(STORE_REGISTROS);
            const index = store.index('dataHora');
            const request = index.openCursor(null, 'prev');
            const resultados = [];
            request.onsuccess = (ev) => {
                const cursor = ev.target.result;
                if (cursor) {
                    resultados.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(resultados);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    function obterRegistroPorId(id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_REGISTROS, 'readonly');
            const store = tx.objectStore(STORE_REGISTROS);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function atualizarRegistro(id, dados) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_REGISTROS, 'readwrite');
            const store = tx.objectStore(STORE_REGISTROS);
            const request = store.put({ ...dados, id });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function excluirRegistro(id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_REGISTROS, 'readwrite');
            const store = tx.objectStore(STORE_REGISTROS);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function limparTodosRegistros() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_REGISTROS, 'readwrite');
            const store = tx.objectStore(STORE_REGISTROS);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ===== RELATÓRIOS SALVOS =====
    function salvarRelatorio(resumo, periodoInicio, periodoFim, periodoLabel) {
        return new Promise((resolve, reject) => {
            const chave = periodoInicio + '_' + periodoFim;
            const tx = db.transaction(STORE_RELATORIOS, 'readwrite');
            const store = tx.objectStore(STORE_RELATORIOS);
            const index = store.index('periodoChave');
            const buscaReq = index.get(chave);
            buscaReq.onsuccess = () => {
                const existente = buscaReq.result;
                const dados = {
                    periodoChave: chave,
                    periodoInicio,
                    periodoFim,
                    periodoLabel,
                    geradoEm: new Date().toISOString(),
                    totalRegistros: resumo.totalRegistros,
                    totalPesoKg: resumo.totalPesoKg,
                    totalValor: resumo.totalValor,
                    porProduto: resumo.porProduto
                };
                if (existente) {
                    dados.id = existente.id;
                    store.put(dados);
                } else {
                    store.add(dados);
                }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function obterRelatoriosSalvos() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_RELATORIOS, 'readonly');
            const store = tx.objectStore(STORE_RELATORIOS);
            const request = store.getAll();
            request.onsuccess = () => {
                const lista = request.result.sort((a, b) => new Date(b.geradoEm) - new Date(a.geradoEm));
                resolve(lista);
            };
            request.onerror = () => reject(request.error);
        });
    }

    function excluirRelatorioSalvo(id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_RELATORIOS, 'readwrite');
            const store = tx.objectStore(STORE_RELATORIOS);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Agrupa uma lista de registros por dia de calendário (dataHora local).
    // Retorna um array ordenado: [{ chaveDia: 'YYYY-MM-DD', periodoLabel: 'dd/mm/aaaa', registros: [...] }]
    // Cada dia vira, futuramente, UM relatório individual — nunca um intervalo inteiro misturado.
    function agruparRegistrosPorDia(registros) {
        const mapa = {};
        registros.forEach(r => {
            const d = new Date(r.dataHora);
            const chave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            if (!mapa[chave]) mapa[chave] = [];
            mapa[chave].push(r);
        });
        return Object.keys(mapa).sort().map(chave => ({
            chaveDia: chave,
            periodoLabel: formatDate(new Date(chave + 'T00:00:00')),
            registros: mapa[chave]
        }));
    }

    // ===== RESUMO / TOTALIZAÇÃO =====
    function calcularResumoRelatorio(registros) {
        const mapa = {};
        let totalPesoKg = 0;
        let totalValor = 0;
        registros.forEach(r => {
            const chave = r.codigo + '||' + r.produto;
            if (!mapa[chave]) {
                mapa[chave] = { codigo: r.codigo, produto: r.produto, qtd: 0, totalKg: 0, totalValor: 0, registros: [] };
            }
            mapa[chave].qtd += 1;
            mapa[chave].totalKg += r.pesoKg;
            mapa[chave].totalValor += r.valorTotal;
            mapa[chave].registros.push(r);
            totalPesoKg += r.pesoKg;
            totalValor += r.valorTotal;
        });
        const porProduto = Object.values(mapa).sort((a, b) => b.totalValor - a.totalValor);
        return {
            totalRegistros: registros.length,
            totalPesoKg,
            totalValor,
            porProduto
        };
    }

    // ===== FILTROS =====
    function filtrarRegistros(registros, termo, periodo, dataIni, dataFim) {
        let filtrados = registros;
        if (termo && termo.trim() !== '') {
            const lower = termo.toLowerCase().trim();
            filtrados = filtrados.filter(r =>
                r.codigo.toLowerCase().includes(lower) ||
                r.produto.toLowerCase().includes(lower) ||
                formatDate(new Date(r.dataHora)).includes(lower)
            );
        }
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        let inicio = null, fim = null;
        switch (periodo) {
            case 'hoje':
                inicio = new Date(hoje);
                fim = new Date(hoje);
                fim.setHours(23, 59, 59, 999);
                break;
            case 'ontem':
                const ontem = new Date(hoje);
                ontem.setDate(ontem.getDate() - 1);
                inicio = new Date(ontem);
                fim = new Date(ontem);
                fim.setHours(23, 59, 59, 999);
                break;
            case '7dias':
                inicio = new Date(hoje);
                inicio.setDate(inicio.getDate() - 7);
                fim = new Date(hoje);
                fim.setHours(23, 59, 59, 999);
                break;
            case 'mes':
                inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                fim.setHours(23, 59, 59, 999);
                break;
            case 'personalizado':
                if (dataIni && dataFim) {
                    inicio = new Date(dataIni + 'T00:00:00');
                    fim = new Date(dataFim + 'T23:59:59');
                }
                break;
            default: break;
        }
        if (inicio && fim) {
            filtrados = filtrados.filter(r => {
                const d = new Date(r.dataHora);
                return d >= inicio && d <= fim;
            });
        }
        return filtrados;
    }

    // ===== RENDERIZAÇÃO =====
    function renderizarRegistros(registros, container, limit = 20, offset = 0) {
        if (!container) return;
        if (registros.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon"><i class="fas fa-inbox"></i></span>
                    <p>Nenhum registro encontrado.</p>
                    <p class="empty-sub">Registre sua primeira quebra na aba "Registrar".</p>
                </div>
            `;
            return;
        }
        const slice = registros.slice(offset, offset + limit);
        let html = '';
        slice.forEach(r => {
            const data = new Date(r.dataHora);
            const temFoto = r.foto && r.foto.length > 0;
            html += `
                <div class="registro-card" data-id="${r.id}">
                    <span class="rc-id">${gerarIdDisplay(r.id)}</span>
                    <span class="rc-data">${formatDate(data)} ${formatTime(data)}</span>
                    <span class="rc-produto">${r.codigo} - ${r.produto}</span>
                    <span class="rc-total">${formatMoeda(r.valorTotal)}</span>
                    <span class="rc-foto">${temFoto ? '<i class="fas fa-camera"></i>' : ''}</span>
                </div>
            `;
        });
        container.innerHTML = html;
        container.querySelectorAll('.registro-card').forEach(el => {
            el.addEventListener('click', () => {
                const id = parseInt(el.dataset.id);
                abrirDetalhe(id);
            });
        });
    }

    // ===== ATUALIZAR CONTADOR =====
    async function atualizarContador() {
        try {
            const todos = await obterTodosRegistros();
            document.getElementById('recordCount').textContent = todos.length;
            document.getElementById('configTotalRegistros').textContent = todos.length;
        } catch (e) {
            console.error(e);
        }
    }

    // ===== CARREGAR LISTA =====
    let cachedRegistros = [];
    let currentPage = 0;
    const PAGE_SIZE = 20;

    async function carregarListaRegistros(offset = 0) {
        const searchTerm = document.getElementById('searchInput').value;
        const periodo = document.getElementById('periodoFilter').value;
        let dataIni = document.getElementById('dataInicial').value;
        let dataFim = document.getElementById('dataFinal').value;
        try {
            const todos = await obterTodosRegistros();
            cachedRegistros = filtrarRegistros(todos, searchTerm, periodo, dataIni, dataFim);
            const container = document.getElementById('registrosList');
            const total = cachedRegistros.length;
            const start = offset;
            const end = Math.min(start + PAGE_SIZE, total);
            if (start === 0) {
                renderizarRegistros(cachedRegistros.slice(0, PAGE_SIZE), container);
                currentPage = 0;
            } else {
                const more = cachedRegistros.slice(start, end);
                const fragment = document.createElement('div');
                renderizarRegistros(more, fragment);
                container.appendChild(fragment);
                currentPage = Math.floor(start / PAGE_SIZE);
            }
            const loadMoreContainer = document.getElementById('loadMoreContainer');
            if (end < total) {
                loadMoreContainer.style.display = 'block';
            } else {
                loadMoreContainer.style.display = 'none';
            }
            atualizarContador();
        } catch (e) {
            console.error(e);
        }
    }

    // ===== ABRIR DETALHE =====
    async function abrirDetalhe(id) {
        try {
            const registro = await obterRegistroPorId(id);
            if (!registro) { alert('Registro não encontrado.'); return; }
            currentViewId = id;
            const body = document.getElementById('detalheBody');
            const data = new Date(registro.dataHora);
            const temFoto = registro.foto && registro.foto.length > 0;
            let fotoHtml = '';
            if (temFoto) {
                fotoHtml = `
                    <div class="detail-photo">
                        <img src="${registro.foto}" alt="Evidência" onclick="window.open('${registro.foto}','_blank')" />
                    </div>
                `;
            } else {
                fotoHtml = `<p class="detail-empty"><i class="fas fa-image"></i> Nenhuma foto anexada.</p>`;
            }
            body.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item"><span class="detail-label"><i class="fas fa-hashtag"></i> ID</span><span class="detail-value mono">${gerarIdDisplay(registro.id)}</span></div>
                    <div class="detail-item"><span class="detail-label"><i class="fas fa-calendar"></i> Data</span><span class="detail-value">${formatDate(data)}</span></div>
                    <div class="detail-item"><span class="detail-label"><i class="fas fa-clock"></i> Hora</span><span class="detail-value">${formatTime(data)}</span></div>
                    <div class="detail-item"><span class="detail-label"><i class="fas fa-hashtag"></i> Código</span><span class="detail-value mono">${registro.codigo}</span></div>
                    <div class="detail-item detail-span2"><span class="detail-label"><i class="fas fa-tag"></i> Produto</span><span class="detail-value">${registro.produto}</span></div>
                    <div class="detail-item"><span class="detail-label"><i class="fas fa-weight-scale"></i> Peso</span><span class="detail-value">${formatPeso(registro.pesoKg)}</span></div>
                    <div class="detail-item"><span class="detail-label"><i class="fas fa-dollar-sign"></i> Valor/kg</span><span class="detail-value">${formatMoeda(registro.valorKg)}</span></div>
                    <div class="detail-item detail-span2 detail-highlight"><span class="detail-label"><i class="fas fa-calculator"></i> Valor total</span><span class="detail-value">${formatMoeda(registro.valorTotal)}</span></div>
                </div>
                <div class="detail-section">
                    <span class="detail-section-title"><i class="fas fa-comment"></i> Observação</span>
                    <p class="detail-text">${registro.observacao || '—'}</p>
                </div>
                <div class="detail-section">
                    <span class="detail-section-title"><i class="fas fa-camera"></i> Evidência</span>
                    ${fotoHtml}
                </div>
            `;
            document.getElementById('modalDetalhe').classList.add('active');
        } catch (e) {
            console.error(e);
            alert('Erro ao carregar o registro.');
        }
    }

    // ===== EXPORTAR BACKUP =====
    async function exportarBackup() {
        try {
            const registros = await obterTodosRegistros();
            const blob = new Blob([JSON.stringify(registros, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_quebras_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Erro ao exportar backup.');
            console.error(e);
        }
    }

    async function restaurarBackup(file) {
        try {
            const text = await file.text();
            const dados = JSON.parse(text);
            if (!Array.isArray(dados)) throw new Error('Formato inválido');
            await limparTodosRegistros();
            const tx = db.transaction(STORE_REGISTROS, 'readwrite');
            const store = tx.objectStore(STORE_REGISTROS);
            for (const item of dados) {
                delete item.id;
                store.add(item);
            }
            await new Promise((resolve, reject) => {
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
            alert('Backup restaurado com sucesso!');
            carregarListaRegistros();
            atualizarContador();
        } catch (e) {
            alert('Erro ao restaurar backup: ' + e.message);
            console.error(e);
        }
    }

    // ===== EXPORTAR CSV (com agrupamento por produto) =====
    function exportarCSV(registros) {
        if (!registros || registros.length === 0) {
            alert('Nenhum registro para exportar.');
            return;
        }
        const resumo = calcularResumoRelatorio(registros);
        let csv = 'RELATÓRIO DE QUEBRAS - PERÍODO INDIVIDUAL\n';
        csv += `Total de registros,${resumo.totalRegistros}\n`;
        csv += `Total em Kg,${resumo.totalPesoKg.toFixed(3).replace('.', ',')}\n`;
        csv += `Total em R$,${resumo.totalValor.toFixed(2).replace('.', ',')}\n`;
        csv += '\n';

        // Por produto - cada produto com seus registros
        resumo.porProduto.forEach(p => {
            csv += `\nPRODUTO: ${p.codigo} - ${p.produto}\n`;
            csv += `Registros: ${p.qtd}, Total Kg: ${p.totalKg.toFixed(3).replace('.', ',')}, Total R$: ${p.totalValor.toFixed(2).replace('.', ',')}\n`;
            csv += 'ID,Data,Hora,Peso (kg),Valor/kg,Valor total,Observação\n';
            p.registros.forEach(r => {
                const d = new Date(r.dataHora);
                csv += `${r.id},${formatDate(d)},${formatTime(d)},${r.pesoKg.toFixed(3).replace('.', ',')},${r.valorKg.toFixed(2).replace('.', ',')},${r.valorTotal.toFixed(2).replace('.', ',')},"${(r.observacao || '').replace(/"/g, '""')}"\n`;
            });
            csv += `SUBTOTAL,${p.qtd},,${p.totalKg.toFixed(3).replace('.', ',')},${p.totalValor.toFixed(2).replace('.', ',')}\n`;
            csv += '\n';
        });

        // Resumo geral novamente
        csv += '\nRESUMO GERAL\n';
        csv += 'Produto,Código,Registros,Total Kg,Total R$\n';
        resumo.porProduto.forEach(p => {
            csv += `${p.produto},${p.codigo},${p.qtd},${p.totalKg.toFixed(3).replace('.', ',')},${p.totalValor.toFixed(2).replace('.', ',')}\n`;
        });
        csv += `TOTAL GERAL,,${resumo.totalRegistros},${resumo.totalPesoKg.toFixed(3).replace('.', ',')},${resumo.totalValor.toFixed(2).replace('.', ',')}\n`;

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_quebras_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ===== EXPORTAR PDF (com agrupamento por produto) =====
    // Desenha o cabeçalho (título + período) de um bloco de relatório no PDF, a partir de y=14.
    function desenharCabecalhoPDF(doc, periodoLabel) {
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 14;
        doc.setFontSize(15);
        doc.setTextColor(26, 73, 114);
        doc.text('REGISTRO DE QUEBRAS — PADARIA', pageWidth / 2, y, { align: 'center' });
        y += 7;
        doc.setFontSize(10.5);
        doc.setTextColor(60, 70, 80);
        doc.text(`Relatório — ${periodoLabel}`, pageWidth / 2, y, { align: 'center' });
        y += 9;
        return y;
    }

    // Desenha as caixas de totais (registros / kg / R$) e retorna o novo y.
    function desenharCaixasResumoPDF(doc, y, resumo) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const boxGap = 5;
        const boxWidth = (pageWidth - 2 * margin - boxGap * 2) / 3;
        const boxes = [
            { label: 'REGISTROS', value: String(resumo.totalRegistros), fill: [248, 249, 251] },
            { label: 'TOTAL EM KG', value: formatPeso(resumo.totalPesoKg), fill: [248, 249, 251] },
            { label: 'TOTAL EM R$', value: formatMoeda(resumo.totalValor), fill: [232, 240, 248] }
        ];
        boxes.forEach((b, i) => {
            const bx = margin + i * (boxWidth + boxGap);
            doc.setDrawColor(210);
            doc.setFillColor(b.fill[0], b.fill[1], b.fill[2]);
            doc.roundedRect(bx, y, boxWidth, 16, 2, 2, 'FD');
            doc.setFontSize(7.5);
            doc.setTextColor(100);
            doc.text(b.label, bx + 4, y + 6);
            doc.setFontSize(13);
            doc.setTextColor(15, 52, 82);
            doc.text(b.value, bx + 4, y + 13);
        });
        return y + 24;
    }

    // Desenha a tabela de registros de UM produto (com quebra de página) e retorna o novo y.
    function desenharTabelaDetalheRegistrosPDF(doc, y, registros) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const headers = ['ID', 'Data', 'Hora', 'Código', 'Produto', 'Peso', 'Valor/kg', 'Total', 'Obs.'];
        const colWidths = [18, 20, 14, 22, 50, 22, 24, 24, 75];

        function desenharCabecalhoTabela(yy) {
            doc.setFillColor(240, 244, 248);
            doc.rect(margin, yy - 4, pageWidth - 2 * margin, 7, 'F');
            let x = margin;
            doc.setFontSize(8);
            doc.setTextColor(40);
            headers.forEach((h, i) => {
                doc.text(h, x + 1, yy + 1);
                x += colWidths[i];
            });
            return yy + 7;
        }

        if (y > 180) {
            doc.addPage();
            y = 14;
        }
        y = desenharCabecalhoTabela(y);
        doc.setTextColor(0);
        registros.forEach(r => {
            if (y > 190) {
                doc.addPage();
                y = 14;
                y = desenharCabecalhoTabela(y);
            }
            const d = new Date(r.dataHora);
            const row = [
                gerarIdDisplay(r.id),
                formatDate(d),
                formatTime(d),
                r.codigo,
                r.produto,
                formatPeso(r.pesoKg),
                formatMoeda(r.valorKg),
                formatMoeda(r.valorTotal),
                (r.observacao || '').slice(0, 30)
            ];
            let x = margin;
            doc.setFontSize(8);
            row.forEach((cell, i) => {
                doc.text(String(cell), x + 1, y + 1);
                x += colWidths[i];
            });
            y += 6;
        });
        return y;
    }

    // Desenha um bloco completo de UM período: cabeçalho + totais + cada produto (com seu
    // subtotal e seus registros) + total geral do período, na página atual do doc.
    function desenharBlocoRelatorioPDF(doc, periodoLabel, resumo) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let y = desenharCabecalhoPDF(doc, periodoLabel);
        y = desenharCaixasResumoPDF(doc, y, resumo);

        (resumo.porProduto || []).forEach(p => {
            if (y > 172) {
                doc.addPage();
                y = 14;
            }
            doc.setFontSize(11);
            doc.setTextColor(26, 73, 114);
            doc.text(`${p.codigo} — ${p.produto}`, margin, y);
            y += 5;
            doc.setFontSize(8.5);
            doc.setTextColor(70);
            doc.text(`${p.qtd} registro(s)  |  Total Kg: ${formatPeso(p.totalKg)}  |  Total R$: ${formatMoeda(p.totalValor)}`, margin, y);
            y += 6;

            y = desenharTabelaDetalheRegistrosPDF(doc, y, p.registros);

            y += 4;
            doc.setDrawColor(210);
            doc.line(margin, y - 2, pageWidth - margin, y - 2);
            y += 4;
        });

        if (y > 182) {
            doc.addPage();
            y = 14;
        }
        doc.setDrawColor(26, 73, 114);
        doc.setLineWidth(0.6);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;
        doc.setFontSize(10.5);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(15, 52, 82);
        doc.text('TOTAL GERAL DO PERÍODO', margin, y);
        doc.text(
            `${resumo.totalRegistros} registros   |   ${formatPeso(resumo.totalPesoKg)}   |   ${formatMoeda(resumo.totalValor)}`,
            pageWidth - margin, y, { align: 'right' }
        );
        doc.setFont(undefined, 'normal');
        y += 8;

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Gerado em ${formatDateTime(new Date())}`, pageWidth - margin, y, { align: 'right' });
    }

    // PDF individual de um relatório já salvo no histórico (somente aquele período/dia).
    function exportarPDFRelatorioSalvo(rel) {
        if (!rel.totalRegistros) {
            alert('Nenhum registro neste relatório.');
            return;
        }
        const resumo = { totalRegistros: rel.totalRegistros, totalPesoKg: rel.totalPesoKg, totalValor: rel.totalValor, porProduto: rel.porProduto || [] };
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        desenharBlocoRelatorioPDF(doc, rel.periodoLabel, resumo);
        doc.save(`relatorio_quebras_${rel.periodoInicio}.pdf`);
    }

    // PDF consolidado com TODOS os períodos (dias) salvos no histórico, cada um em seu próprio
    // bloco, com os produtos daquele dia isolados — nenhum período se mistura com outro.
    async function exportarPDFCompleto() {
        try {
            const lista = await obterRelatoriosSalvos();
            if (lista.length === 0) {
                alert('Nenhum relatório salvo para incluir no PDF completo.');
                return;
            }
            const ordenada = lista.slice().sort((a, b) => new Date(a.periodoInicio) - new Date(b.periodoInicio));
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape', 'mm', 'a4');
            ordenada.forEach((rel, idx) => {
                if (idx > 0) doc.addPage();
                const resumo = { totalRegistros: rel.totalRegistros, totalPesoKg: rel.totalPesoKg, totalValor: rel.totalValor, porProduto: rel.porProduto || [] };
                desenharBlocoRelatorioPDF(doc, rel.periodoLabel, resumo);
            });
            doc.save(`relatorio_quebras_completo_${new Date().toISOString().slice(0,10)}.pdf`);
        } catch (e) {
            alert('Erro ao gerar PDF completo.');
            console.error(e);
        }
    }

    // ===== RENDERIZAR TABELA DE REGISTROS DETALHADOS =====
    function renderDetalheTabelaHtml(registros) {
        let html = `<table class="relatorio-tabela"><thead><tr>
            <th>ID</th><th>Data</th><th>Hora</th><th>Código</th><th>Produto</th>
            <th class="num">Peso</th><th class="num">Valor/kg</th><th class="num">Total</th><th>Obs.</th>
        </tr></thead><tbody>`;
        registros.forEach(r => {
            const d = new Date(r.dataHora);
            html += `<tr>
                <td>${gerarIdDisplay(r.id)}</td>
                <td>${formatDate(d)}</td>
                <td>${formatTime(d)}</td>
                <td>${r.codigo}</td>
                <td>${r.produto}</td>
                <td class="num">${formatPeso(r.pesoKg)}</td>
                <td class="num">${formatMoeda(r.valorKg)}</td>
                <td class="num"><strong>${formatMoeda(r.valorTotal)}</strong></td>
                <td>${(r.observacao || '').slice(0, 20)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
        return html;
    }

    // ===== RENDERIZAR OS BLOCOS POR PRODUTO (cada produto com seu total + seus registros) =====
    function renderProdutosBlocoHtml(porProduto) {
        let html = '<div class="rel-produtos-wrap">';
        (porProduto || []).forEach(p => {
            html += `
                <div class="rel-produto-bloco">
                    <div class="rel-produto-header">
                        <span class="rel-produto-nome"><i class="fas fa-box"></i> ${p.codigo} — ${p.produto}</span>
                        <span class="rel-produto-totais">
                            <span>${p.qtd} registro${p.qtd === 1 ? '' : 's'}</span>
                            <span>${formatPeso(p.totalKg)}</span>
                            <strong>${formatMoeda(p.totalValor)}</strong>
                        </span>
                    </div>
                    ${renderDetalheTabelaHtml(p.registros)}
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    // ===== RENDERIZAR O BLOCO COMPLETO DE UM PERÍODO (1 dia) =====
    // Estrutura: cabeçalho do período -> caixas de totais -> produtos (com seus registros) -> total geral do período
    function renderRelatorioDiaHtml(periodoLabel, resumo) {
        return `
            <div class="rel-periodo-bloco">
                <div class="rel-periodo-header">
                    <span class="rel-periodo-titulo"><i class="fas fa-calendar-day"></i> Relatório — ${periodoLabel}</span>
                </div>
                <div class="rel-stats">
                    <div class="rel-stat">
                        <span class="rel-stat-label"><i class="fas fa-list-ol"></i> Registros</span>
                        <span class="rel-stat-value">${resumo.totalRegistros}</span>
                    </div>
                    <div class="rel-stat">
                        <span class="rel-stat-label"><i class="fas fa-weight-scale"></i> Total em Kg</span>
                        <span class="rel-stat-value">${formatPeso(resumo.totalPesoKg)}</span>
                    </div>
                    <div class="rel-stat rel-stat-primary">
                        <span class="rel-stat-label"><i class="fas fa-sack-dollar"></i> Total em R$</span>
                        <span class="rel-stat-value">${formatMoeda(resumo.totalValor)}</span>
                    </div>
                </div>
                ${renderProdutosBlocoHtml(resumo.porProduto)}
                <div class="rel-total-geral">
                    <span class="rel-total-geral-label"><i class="fas fa-calculator"></i> Total geral do período</span>
                    <span class="rel-total-geral-valores">
                        <span>${resumo.totalRegistros} reg.</span>
                        <span>${formatPeso(resumo.totalPesoKg)}</span>
                        <span>${formatMoeda(resumo.totalValor)}</span>
                    </span>
                </div>
            </div>
        `;
    }

    // ===== HISTÓRICO DE RELATÓRIOS SALVOS =====
    async function renderHistoricoRelatorios() {
        const container = document.getElementById('historicoRelatorios');
        if (!container) return;
        try {
            const lista = await obterRelatoriosSalvos();
            if (lista.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon"><i class="fas fa-clock-rotate-left"></i></span>
                        <p>Nenhum relatório salvo ainda.</p>
                        <p class="empty-sub">Gere um relatório acima para começar o histórico.</p>
                    </div>
                `;
                return;
            }
            let html = '';
            lista.forEach(rel => {
                html += `
                    <div class="historico-item" data-id="${rel.id}">
                        <span class="hi-periodo"><i class="fas fa-calendar-week"></i> ${rel.periodoLabel}</span>
                        <span class="hi-meta">Salvo em ${formatDateTime(new Date(rel.geradoEm))}</span>
                        <span class="hi-totais">
                            <span>${rel.totalRegistros} reg.</span>
                            <span>${formatPeso(rel.totalPesoKg)}</span>
                            <strong>${formatMoeda(rel.totalValor)}</strong>
                        </span>
                        <span class="hi-actions">
                            <button type="button" class="btn btn-sm btn-outline hi-ver" data-id="${rel.id}" title="Visualizar"><i class="fas fa-eye"></i></button>
                            <button type="button" class="btn btn-sm btn-outline hi-pdf" data-id="${rel.id}" title="Gerar PDF deste período"><i class="fas fa-file-pdf"></i></button>
                            <button type="button" class="btn btn-sm btn-danger hi-excluir" data-id="${rel.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                        </span>
                    </div>
                `;
            });
            container.innerHTML = `<div class="historico-list">${html}</div>`;
            container.querySelectorAll('.hi-ver').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    const lista2 = await obterRelatoriosSalvos();
                    const rel = lista2.find(r => r.id === id);
                    if (rel) exibirResumoSalvo(rel);
                });
            });
            container.querySelectorAll('.hi-pdf').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    const lista2 = await obterRelatoriosSalvos();
                    const rel = lista2.find(r => r.id === id);
                    if (rel) exportarPDFRelatorioSalvo(rel);
                });
            });
            container.querySelectorAll('.hi-excluir').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    if (!confirm('Excluir este relatório salvo do histórico?\n\nIsso não afeta os registros originais, apenas o resumo salvo deste período.')) return;
                    await excluirRelatorioSalvo(id);
                    renderHistoricoRelatorios();
                });
            });
        } catch (e) {
            console.error(e);
        }
    }

    function exibirResumoSalvo(rel) {
        const container = document.getElementById('relatorioResultado');
        const resumo = { totalRegistros: rel.totalRegistros, totalPesoKg: rel.totalPesoKg, totalValor: rel.totalValor, porProduto: rel.porProduto || [] };
        container.innerHTML = `
            <p class="rel-snapshot-note"><i class="fas fa-clock-rotate-left"></i> Visualizando relatório salvo de <strong>${rel.periodoLabel}</strong> (período individual, sem acúmulo com outros períodos).</p>
            ${renderRelatorioDiaHtml(rel.periodoLabel, resumo)}
        `;
        window._relatorioDiasGerados = [{ periodoLabel: rel.periodoLabel, resumo }];
        document.getElementById('relDataInicial').value = rel.periodoInicio;
        document.getElementById('relDataFinal').value = rel.periodoFim;
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ===== GERAR RELATÓRIO(S) =====
    // REGRA FUNDAMENTAL: RELATÓRIO = UM ÚNICO PERÍODO (1 dia).
    // O intervalo selecionado em Data Inicial/Data Final apenas determina QUAIS dias serão
    // processados — cada dia com registros gera seu próprio relatório individual, salvo
    // separadamente no histórico. Nunca cria um relatório único somando o intervalo inteiro.
    async function gerarRelatorio() {
        const dataIni = document.getElementById('relDataInicial').value;
        const dataFim = document.getElementById('relDataFinal').value;
        if (!dataIni || !dataFim) {
            alert('Selecione o período inicial e final.');
            return;
        }
        if (dataIni > dataFim) {
            alert('A data inicial não pode ser depois da data final.');
            return;
        }
        try {
            const todos = await obterTodosRegistros();
            const inicio = new Date(dataIni + 'T00:00:00');
            const fim = new Date(dataFim + 'T23:59:59');
            const noIntervalo = todos.filter(r => {
                const d = new Date(r.dataHora);
                return d >= inicio && d <= fim;
            });

            const container = document.getElementById('relatorioResultado');
            if (noIntervalo.length === 0) {
                container.innerHTML = `<div class="empty-state"><span class="empty-icon"><i class="fas fa-inbox"></i></span><p>Nenhum registro no período selecionado.</p></div>`;
                window._relatorioDiasGerados = null;
                return;
            }

            // Cada dia do intervalo vira um relatório independente — os registros de um dia
            // nunca entram no relatório de outro dia.
            const porDia = agruparRegistrosPorDia(noIntervalo);
            let blocosHtml = '';
            const diasGerados = [];
            for (const dia of porDia) {
                const resumo = calcularResumoRelatorio(dia.registros);
                // Upsert: gerar novamente um dia já existente ATUALIZA o relatório daquele dia,
                // nunca cria duplicata nem mistura com outros dias (chave = o próprio dia).
                await salvarRelatorio(resumo, dia.chaveDia, dia.chaveDia, dia.periodoLabel);
                blocosHtml += renderRelatorioDiaHtml(dia.periodoLabel, resumo);
                diasGerados.push({ periodoLabel: dia.periodoLabel, resumo });
            }

            const qtdDias = porDia.length;
            container.innerHTML = `
                <p class="rel-footer-note"><i class="fas fa-check-circle"></i> ${qtdDias} relatório${qtdDias === 1 ? '' : 's'} individual${qtdDias === 1 ? '' : 'ais'} (um por dia) ${qtdDias === 1 ? 'gerado' : 'gerados'} e salvo${qtdDias === 1 ? '' : 's'} no histórico — nenhum registro é compartilhado entre dias diferentes.</p>
                ${blocosHtml}
            `;

            window._relatorioDiasGerados = diasGerados;
            renderHistoricoRelatorios();
        } catch (e) {
            alert('Erro ao gerar relatório.');
            console.error(e);
        }
    }

    // ===== IMPRIMIR RELATÓRIO(S) =====
    // Imprime todos os blocos de período (dias) gerados na última chamada de Gerar Relatório
    // ou exibidos via Visualizar no histórico — cada período em sua própria seção, sem misturar.
    function imprimirRelatorio() {
        const dias = window._relatorioDiasGerados;
        if (!dias || dias.length === 0) {
            alert('Gere o relatório primeiro.');
            return;
        }

        let blocosHtml = '';
        dias.forEach((dia, idx) => {
            blocosHtml += renderRelatorioDiaPrintHtml(dia.periodoLabel, dia.resumo, idx > 0);
        });

        const printContent = document.getElementById('relatorioPrint');
        printContent.innerHTML = `
            <div style="max-width:900px; margin:0 auto; padding:20px; font-family:'Inter', system-ui, sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #101828; padding-bottom:10px; margin-bottom:4px;">
                    <h1 style="font-size:1.3rem; font-weight:800; letter-spacing:-0.3px;">REGISTRO DE QUEBRAS — PADARIA</h1>
                    <span style="font-size:0.78rem; color:#667085;">Relatório de auditoria</span>
                </div>
                ${blocosHtml}
                <p style="margin-top:18px; color:#667085; font-size:0.78rem;">Gerado em ${formatDateTime(new Date())}</p>
            </div>
        `;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(`
            <html><head><title>Relatório de Quebras</title>
            <style>
                body { font-family: system-ui, sans-serif; padding:20px; }
                table { width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:10px; }
                th { background:#f1f5f9; text-align:left; padding:7px 9px; border:1px solid #ccc; }
                td { padding:7px 9px; border:1px solid #ccc; }
                @media print {
                    body { padding:0; }
                    .rel-print-periodo.quebra-pagina { page-break-before: always; }
                }
            </style>
            </head><body>
            ${printContent.innerHTML}
            <script>
                window.onload = function() { window.print(); window.close(); };
            <\/script>
            </body></html>
        `);
        printWindow.document.close();
    }

    // Monta o HTML de impressão de UM período: cabeçalho + totais + produtos (com registros) + total geral.
    function renderRelatorioDiaPrintHtml(periodoLabel, resumo, quebraPagina) {
        let produtosHtml = '';
        (resumo.porProduto || []).forEach(p => {
            let linhas = '';
            p.registros.forEach(r => {
                const d = new Date(r.dataHora);
                linhas += `<tr>
                    <td>${gerarIdDisplay(r.id)}</td><td>${formatDate(d)}</td><td>${formatTime(d)}</td>
                    <td>${r.codigo}</td><td>${r.produto}</td>
                    <td style="text-align:right;">${formatPeso(r.pesoKg)}</td>
                    <td style="text-align:right;">${formatMoeda(r.valorKg)}</td>
                    <td style="text-align:right;">${formatMoeda(r.valorTotal)}</td>
                    <td>${(r.observacao || '').slice(0, 25)}</td>
                </tr>`;
            });
            produtosHtml += `
                <div style="margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; background:#f1f5f9; padding:7px 10px; border-radius:6px 6px 0 0; border:1px solid #ccc; border-bottom:none;">
                        <strong style="font-size:0.85rem;">${p.codigo} — ${p.produto}</strong>
                        <span style="font-size:0.78rem; color:#475569;">${p.qtd} reg. &nbsp;|&nbsp; ${formatPeso(p.totalKg)} &nbsp;|&nbsp; ${formatMoeda(p.totalValor)}</span>
                    </div>
                    <table style="margin-bottom:0;"><thead><tr>
                        <th>ID</th><th>Data</th><th>Hora</th><th>Código</th><th>Produto</th>
                        <th>Peso</th><th>Valor/kg</th><th>Total</th><th>Obs.</th>
                    </tr></thead><tbody>${linhas}</tbody></table>
                </div>
            `;
        });

        return `
            <div class="rel-print-periodo${quebraPagina ? ' quebra-pagina' : ''}" style="margin-top:22px;">
                <h2 style="font-size:1.05rem; color:#101828; border-bottom:1px solid #ccc; padding-bottom:6px; margin-bottom:12px;">Relatório — ${periodoLabel}</h2>
                <div style="display:flex; gap:12px; margin-bottom:16px;">
                    <div style="flex:1; border:1px solid #ccc; border-radius:8px; padding:10px 14px;">
                        <div style="font-size:0.68rem; text-transform:uppercase; color:#667085; font-weight:700;">Registros</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#101828;">${resumo.totalRegistros}</div>
                    </div>
                    <div style="flex:1; border:1px solid #ccc; border-radius:8px; padding:10px 14px;">
                        <div style="font-size:0.68rem; text-transform:uppercase; color:#667085; font-weight:700;">Total em Kg</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#101828;">${formatPeso(resumo.totalPesoKg)}</div>
                    </div>
                    <div style="flex:1; border:1px solid #1a4972; border-radius:8px; padding:10px 14px; background:#e8f0f8;">
                        <div style="font-size:0.68rem; text-transform:uppercase; color:#0f3452; font-weight:700;">Total em R$</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#0f3452;">${formatMoeda(resumo.totalValor)}</div>
                    </div>
                </div>
                ${produtosHtml}
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:2px solid #101828; padding-top:8px; margin-top:4px; font-weight:800;">
                    <span>TOTAL GERAL DO PERÍODO</span>
                    <span>${resumo.totalRegistros} registros &nbsp;|&nbsp; ${formatPeso(resumo.totalPesoKg)} &nbsp;|&nbsp; ${formatMoeda(resumo.totalValor)}</span>
                </div>
            </div>
        `;
    }

    // ===== EXPORTAR DADOS =====
    async function exportarDados() {
        try {
            const registros = await obterTodosRegistros();
            const blob = new Blob([JSON.stringify(registros, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dados_quebras_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Erro ao exportar dados.');
            console.error(e);
        }
    }

    // ===== GERENCIAMENTO DE PRODUTOS (CRUD) =====
    async function renderizarProdutos() {
        const container = document.getElementById('produtosList');
        if (!container) return;
        try {
            const produtos = await obterTodosProdutos();
            if (produtos.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon"><i class="fas fa-box-open"></i></span>
                        <p>Nenhum produto cadastrado.</p>
                        <p class="empty-sub">Clique em "Novo Produto" para adicionar.</p>
                    </div>
                `;
                return;
            }
            let html = `<div class="produtos-tabela-wrap"><table class="produtos-tabela">
                <thead><tr><th>Código</th><th>Nome</th><th style="width:120px;">Ações</th></tr></thead><tbody>`;
            produtos.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
            produtos.forEach(p => {
                html += `<tr>
                    <td>${p.codigo}</td>
                    <td>${p.nome}</td>
                    <td>
                        <button class="btn btn-sm btn-outline btn-editar-produto" data-codigo="${p.codigo}"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger btn-excluir-produto" data-codigo="${p.codigo}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
            container.innerHTML = html;

            // Eventos
            container.querySelectorAll('.btn-editar-produto').forEach(btn => {
                btn.addEventListener('click', () => {
                    const codigo = btn.dataset.codigo;
                    abrirModalProduto(codigo);
                });
            });
            container.querySelectorAll('.btn-excluir-produto').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const codigo = btn.dataset.codigo;
                    if (!confirm(`Tem certeza que deseja excluir o produto ${codigo}?`)) return;
                    try {
                        await excluirProduto(codigo);
                        renderizarProdutos();
                        // Atualizar sugestões se necessário
                    } catch (e) {
                        alert('Erro ao excluir produto.');
                        console.error(e);
                    }
                });
            });
        } catch (e) {
            console.error(e);
        }
    }

    function abrirModalProduto(codigo = null) {
        const modal = document.getElementById('modalProduto');
        const form = document.getElementById('formProduto');
        const inputCodigo = document.getElementById('produtoCodigo');
        const inputNome = document.getElementById('produtoNome');
        const editId = document.getElementById('produtoEditId');

        form.reset();
        editId.value = '';
        if (codigo) {
            // Edição
            document.getElementById('modalProdutoTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Produto';
            obterProdutoPorCodigo(codigo).then(prod => {
                if (prod) {
                    inputCodigo.value = prod.codigo;
                    inputNome.value = prod.nome;
                    inputCodigo.readOnly = true; // não permitir alterar código
                    editId.value = prod.codigo;
                }
            });
        } else {
            document.getElementById('modalProdutoTitle').innerHTML = '<i class="fas fa-plus"></i> Novo Produto';
            inputCodigo.readOnly = false;
        }
        modal.classList.add('active');
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-close="modalProduto"]')) {
            document.getElementById('modalProduto').classList.remove('active');
        }
        if (e.target === document.getElementById('modalProduto')) {
            document.getElementById('modalProduto').classList.remove('active');
        }
    });

    document.getElementById('btnSalvarProduto').addEventListener('click', async () => {
        const codigo = document.getElementById('produtoCodigo').value.trim();
        const nome = document.getElementById('produtoNome').value.trim();
        if (!codigo || !nome) {
            alert('Preencha código e nome.');
            return;
        }
        const editId = document.getElementById('produtoEditId').value;
        try {
            if (editId) {
                // Editar
                await atualizarProduto(editId, nome);
            } else {
                // Adicionar
                const existente = await obterProdutoPorCodigo(codigo);
                if (existente) {
                    alert('Já existe um produto com este código.');
                    return;
                }
                await adicionarProduto(codigo, nome);
            }
            document.getElementById('modalProduto').classList.remove('active');
            renderizarProdutos();
        } catch (e) {
            alert('Erro ao salvar produto.');
            console.error(e);
        }
    });

    document.getElementById('btnAdicionarProduto').addEventListener('click', () => {
        abrirModalProduto();
    });

    // ===== SUGESTÃO DE PRODUTO NO REGISTRO =====
    async function buscarProdutoPorCodigo(codigo) {
        if (!codigo || codigo.length < 1) return null;
        try {
            const produto = await obterProdutoPorCodigo(codigo);
            return produto;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    // Evento de input no campo código
    document.getElementById('codigo').addEventListener('input', async function() {
        const codigo = this.value.trim();
        if (codigo.length === 0) {
            document.getElementById('produtoSugestao').style.display = 'none';
            return;
        }
        const produto = await buscarProdutoPorCodigo(codigo);
        if (produto) {
            document.getElementById('produto').value = produto.nome;
            document.getElementById('produtoSugestao').style.display = 'none';
        } else {
            // Se não encontrar, deixa o campo produto vazio (ou mantém o que já foi digitado)
            // Não forçar limpeza, pois pode ser um produto novo
            // Apenas exibir sugestão de que não foi encontrado?
            document.getElementById('produtoSugestao').innerHTML = `<span style="color:var(--text-muted);">Produto não encontrado na base. Digite manualmente.</span>`;
            document.getElementById('produtoSugestao').style.display = 'block';
        }
    });

    // ===== DASHBOARD GERENCIAL =====
    // Camada de LEITURA/ANÁLISE apenas: consulta os registros (STORE_REGISTROS) e os
    // relatórios já salvos (STORE_RELATORIOS) e calcula tudo em memória, reutilizando
    // calcularResumoRelatorio / agruparRegistrosPorDia / desenharBlocoRelatorioPDF já
    // existentes. Não cria nenhuma store nova nem duplica registros.

    let dashSortRanking = 'kg';
    let dashMetricaTendencia = 'kg';
    let dashVerTodosBarras = false;
    let dashCacheResumo = null;   // último resumo (porProduto) calculado
    let dashCachePorDia = null;   // últimos totais por dia calculados
    let dashCacheRelatorios = []; // último snapshot de relatoriosSalvos

    function dashEmptyStateHtml(msg) {
        return `
            <div class="empty-state dash-empty">
                <span class="empty-icon"><i class="fas fa-chart-simple"></i></span>
                <p>${msg || 'Sem dados suficientes para este período.'}</p>
            </div>
        `;
    }

    // Filtra os registros originais pelo intervalo de datas e produto do Dashboard,
    // sem alterar nem duplicar os registros — apenas leitura.
    function filtrarRegistrosDashboard(registros, dataIni, dataFim, produtoCodigo) {
        let filtrados = registros;
        if (dataIni && dataFim) {
            const inicio = new Date(dataIni + 'T00:00:00');
            const fim = new Date(dataFim + 'T23:59:59');
            filtrados = filtrados.filter(r => {
                const d = new Date(r.dataHora);
                return d >= inicio && d <= fim;
            });
        }
        if (produtoCodigo) {
            filtrados = filtrados.filter(r => r.codigo === produtoCodigo);
        }
        return filtrados;
    }

    // ===== KPIs =====
    function renderDashKpis(resumo) {
        const container = document.getElementById('dashKpis');
        if (!container) return;
        const maiorKg = resumo.porProduto.length
            ? resumo.porProduto.slice().sort((a, b) => b.totalKg - a.totalKg)[0]
            : null;
        container.innerHTML = `
            <div class="dash-kpi-card dash-kpi-blue">
                <span class="dash-kpi-icon"><i class="fas fa-clipboard-list"></i></span>
                <span class="dash-kpi-label">Registros</span>
                <span class="dash-kpi-value">${resumo.totalRegistros}</span>
                <span class="dash-kpi-sub">Quebras registradas</span>
            </div>
            <div class="dash-kpi-card dash-kpi-green">
                <span class="dash-kpi-icon"><i class="fas fa-weight-scale"></i></span>
                <span class="dash-kpi-label">Peso total</span>
                <span class="dash-kpi-value">${formatPeso(resumo.totalPesoKg)}</span>
                <span class="dash-kpi-sub">Total de quebras</span>
            </div>
            <div class="dash-kpi-card dash-kpi-amber">
                <span class="dash-kpi-icon"><i class="fas fa-sack-dollar"></i></span>
                <span class="dash-kpi-label">Valor total</span>
                <span class="dash-kpi-value">${formatMoeda(resumo.totalValor)}</span>
                <span class="dash-kpi-sub">Total das quebras</span>
            </div>
            <div class="dash-kpi-card dash-kpi-purple">
                <span class="dash-kpi-icon"><i class="fas fa-award"></i></span>
                <span class="dash-kpi-label">Maior quebra (por Kg)</span>
                <span class="dash-kpi-value dash-kpi-value-sm">${maiorKg ? maiorKg.produto : '—'}</span>
                <span class="dash-kpi-sub">${maiorKg ? `${formatPeso(maiorKg.totalKg)} • ${formatMoeda(maiorKg.totalValor)}` : 'Sem dados no período'}</span>
            </div>
        `;
    }

    // ===== RANKING DE PRODUTOS =====
    function renderDashRanking(porProduto, sortKey) {
        const container = document.getElementById('dashRankingProdutos');
        if (!container) return;
        if (!porProduto.length) {
            container.innerHTML = dashEmptyStateHtml('Nenhum produto com quebra no período selecionado.');
            return;
        }
        const totalKgGeral = porProduto.reduce((s, p) => s + p.totalKg, 0);
        const totalValorGeral = porProduto.reduce((s, p) => s + p.totalValor, 0);
        const campo = sortKey === 'valor' ? 'totalValor' : (sortKey === 'qtd' ? 'qtd' : 'totalKg');
        const ordenado = porProduto.slice().sort((a, b) => b[campo] - a[campo]);
        let html = '<div class="dash-ranking-list">';
        ordenado.forEach((p, idx) => {
            const pctKg = totalKgGeral ? (p.totalKg / totalKgGeral * 100) : 0;
            const pctValor = totalValorGeral ? (p.totalValor / totalValorGeral * 100) : 0;
            html += `
                <div class="dash-ranking-item">
                    <span class="dash-rank-pos">${idx + 1}</span>
                    <span class="dash-rank-info">
                        <span class="dash-rank-nome">${p.codigo} — ${p.produto}</span>
                        <span class="dash-rank-meta">${p.qtd} registro${p.qtd === 1 ? '' : 's'} · ${formatPeso(p.totalKg)} · ${formatMoeda(p.totalValor)}</span>
                    </span>
                    <span class="dash-rank-pct">
                        <span>${pctKg.toFixed(1)}% kg</span>
                        <span>${pctValor.toFixed(1)}% R$</span>
                    </span>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // ===== GRÁFICO: QUEBRA POR PRODUTO (barras horizontais) =====
    function renderDashBarChart(porProduto, verTodos) {
        const container = document.getElementById('dashGraficoBarras');
        const btnVerTodos = document.getElementById('btnDashVerTodosBarras');
        if (!container) return;
        if (!porProduto.length) {
            container.innerHTML = dashEmptyStateHtml('Nenhum produto com quebra no período selecionado.');
            if (btnVerTodos) btnVerTodos.style.display = 'none';
            return;
        }
        const ordenado = porProduto.slice().sort((a, b) => b.totalKg - a.totalKg);
        const lista = verTodos ? ordenado : ordenado.slice(0, 10);
        const max = ordenado[0].totalKg || 1;
        let html = '<div class="dash-bar-chart">';
        lista.forEach(p => {
            const pct = Math.max(2, (p.totalKg / max * 100));
            html += `
                <div class="dash-bar-row">
                    <span class="dash-bar-label" title="${p.codigo} — ${p.produto}">${p.produto}</span>
                    <span class="dash-bar-track"><span class="dash-bar-fill" style="width:${pct.toFixed(1)}%"></span></span>
                    <span class="dash-bar-value">${formatPeso(p.totalKg)}</span>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
        if (btnVerTodos) {
            btnVerTodos.style.display = ordenado.length > 10 ? 'inline-flex' : 'none';
            btnVerTodos.innerHTML = verTodos
                ? '<i class="fas fa-chevron-up"></i> Ver top 10'
                : '<i class="fas fa-chevron-down"></i> Ver todos';
        }
    }

    // ===== GRÁFICO: TENDÊNCIA DAS QUEBRAS (linha em SVG) =====
    function dashFormatEixo(valor, metrica) {
        if (metrica === 'valor') return 'R$ ' + Math.round(valor);
        if (metrica === 'qtd') return String(Math.round(valor));
        return Math.round(valor) + 'kg';
    }

    function renderDashTendencia(porDia, metrica) {
        const container = document.getElementById('dashGraficoTendencia');
        if (!container) return;
        if (!porDia.length) {
            container.innerHTML = dashEmptyStateHtml('Sem períodos suficientes para traçar a tendência.');
            return;
        }
        const campo = metrica === 'valor' ? 'totalValor' : (metrica === 'qtd' ? 'totalRegistros' : 'totalPesoKg');
        const valores = porDia.map(d => d.resumo[campo]);
        const max = Math.max(...valores, 1);
        const w = 640, h = 220, padL = 44, padR = 12, padT = 14, padB = 30;
        const innerW = w - padL - padR, innerH = h - padT - padB;
        const n = porDia.length;
        const pontos = porDia.map((d, i) => ({
            x: padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
            y: padT + innerH - (valores[i] / max) * innerH,
            label: d.periodoLabel,
            valor: valores[i]
        }));
        const pathD = pontos.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
        const baseY = (padT + innerH).toFixed(1);
        const areaD = `${pathD} L ${pontos[n - 1].x.toFixed(1)} ${baseY} L ${pontos[0].x.toFixed(1)} ${baseY} Z`;

        let gridHtml = '';
        for (let i = 0; i <= 3; i++) {
            const gy = padT + innerH - (i / 3) * innerH;
            const val = max * i / 3;
            gridHtml += `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${w - padR}" y2="${gy.toFixed(1)}" stroke="var(--border-color)" stroke-width="1" />`;
            gridHtml += `<text x="${padL - 6}" y="${(gy + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="var(--text-muted)">${dashFormatEixo(val, metrica)}</text>`;
        }
        let xLabelsHtml = '';
        const step = Math.max(1, Math.ceil(n / 6));
        pontos.forEach((p, i) => {
            if (i % step === 0 || i === n - 1) {
                xLabelsHtml += `<text x="${p.x.toFixed(1)}" y="${h - 8}" font-size="9" text-anchor="middle" fill="var(--text-muted)">${p.label.slice(0, 5)}</text>`;
            }
        });
        const dotsHtml = pontos.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--primary)" stroke="#fff" stroke-width="1.5"><title>${p.label}: ${dashFormatEixo(p.valor, metrica)}</title></circle>`).join('');

        container.innerHTML = `
            <svg viewBox="0 0 ${w} ${h}" class="dash-trend-svg" preserveAspectRatio="xMidYMid meet">
                ${gridHtml}
                <path d="${areaD}" fill="rgba(var(--primary-rgb), 0.08)" stroke="none"></path>
                <path d="${pathD}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
                ${dotsHtml}
                ${xLabelsHtml}
            </svg>
        `;
    }

    // ===== PERÍODOS COM MAIOR QUEBRA =====
    function renderDashPeriodos(porDia) {
        const container = document.getElementById('dashPeriodosTabela');
        if (!container) return;
        if (!porDia.length) {
            container.innerHTML = dashEmptyStateHtml('Nenhum período com registros neste intervalo.');
            return;
        }
        const ordenado = porDia.slice().sort((a, b) => b.resumo.totalPesoKg - a.resumo.totalPesoKg).slice(0, 8);
        let html = '<div class="dash-periodos-table">';
        html += `
            <div class="dash-periodos-row dash-periodos-header">
                <span>Período</span><span>Reg.</span><span>Kg</span><span>R$</span><span></span>
            </div>
        `;
        ordenado.forEach(d => {
            html += `
                <div class="dash-periodos-row">
                    <span>${d.periodoLabel}</span>
                    <span>${d.resumo.totalRegistros}</span>
                    <span>${formatPeso(d.resumo.totalPesoKg)}</span>
                    <span>${formatMoeda(d.resumo.totalValor)}</span>
                    <span class="dash-periodo-acoes">
                        <button type="button" class="btn btn-sm btn-outline dash-periodo-ver" data-chave="${d.chaveDia}" title="Visualizar"><i class="fas fa-eye"></i></button>
                        <button type="button" class="btn btn-sm btn-outline dash-periodo-pdf" data-chave="${d.chaveDia}" title="PDF deste período"><i class="fas fa-file-pdf"></i></button>
                    </span>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.dash-periodo-ver').forEach(btn => {
            btn.addEventListener('click', () => {
                const dia = porDia.find(d => d.chaveDia === btn.dataset.chave);
                if (!dia) return;
                navegarPara('relatorios');
                exibirResumoSalvo({
                    periodoLabel: dia.periodoLabel,
                    periodoInicio: dia.chaveDia,
                    periodoFim: dia.chaveDia,
                    totalRegistros: dia.resumo.totalRegistros,
                    totalPesoKg: dia.resumo.totalPesoKg,
                    totalValor: dia.resumo.totalValor,
                    porProduto: dia.resumo.porProduto
                });
            });
        });
        container.querySelectorAll('.dash-periodo-pdf').forEach(btn => {
            btn.addEventListener('click', () => {
                const dia = porDia.find(d => d.chaveDia === btn.dataset.chave);
                if (!dia) return;
                // Usa o relatório individual já salvo daquele dia, se existir; caso contrário,
                // gera o PDF a partir do mesmo cálculo (calcularResumoRelatorio), sem criar
                // um relatório "diferente" nem duplicar a fonte de dados.
                const existente = dashCacheRelatorios.find(r => r.periodoChave === dia.chaveDia + '_' + dia.chaveDia);
                if (existente) {
                    exportarPDFRelatorioSalvo(existente);
                    return;
                }
                if (!dia.resumo.totalRegistros) {
                    alert('Nenhum registro neste período.');
                    return;
                }
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('landscape', 'mm', 'a4');
                desenharBlocoRelatorioPDF(doc, dia.periodoLabel, dia.resumo);
                doc.save(`relatorio_quebras_${dia.chaveDia}.pdf`);
            });
        });
    }

    // ===== ATENÇÃO (alertas gerenciais) =====
    // Critérios estatísticos simples (média, desvio padrão e fatia proporcional) — nunca
    // limites fixos "inventados" — e cada alerta só aparece se houver amostra suficiente.
    function calcularAlertasDashboard(porProduto, porDia) {
        const alertas = [];
        if (!porProduto.length) return alertas;

        const totalKgGeral = porProduto.reduce((s, p) => s + p.totalKg, 0);
        const totalValorGeral = porProduto.reduce((s, p) => s + p.totalValor, 0);

        const maiorKg = porProduto.slice().sort((a, b) => b.totalKg - a.totalKg)[0];
        if (maiorKg) {
            alertas.push({
                icone: 'fa-crown',
                titulo: `${maiorKg.produto} é o produto com maior quebra`,
                detalhe: `${formatPeso(maiorKg.totalKg)} · ${formatMoeda(maiorKg.totalValor)} no período (${maiorKg.qtd} registro${maiorKg.qtd === 1 ? '' : 's'})`
            });
        }

        if (porProduto.length >= 3) {
            const media = totalKgGeral / porProduto.length;
            const variancia = porProduto.reduce((s, p) => s + Math.pow(p.totalKg - media, 2), 0) / porProduto.length;
            const desvio = Math.sqrt(variancia);
            if (desvio > 0) {
                porProduto
                    .filter(p => p !== maiorKg && p.totalKg > media + desvio)
                    .slice(0, 2)
                    .forEach(p => {
                        alertas.push({
                            icone: 'fa-arrow-trend-up',
                            titulo: `${p.produto} está bem acima da média de quebra`,
                            detalhe: `${formatPeso(p.totalKg)} no período, contra uma média de ${formatPeso(media)} por produto`
                        });
                    });
            }
        }

        if (porProduto.length >= 3 && totalValorGeral > 0) {
            const fatiaUniforme = 100 / porProduto.length;
            porProduto.forEach(p => {
                const pct = (p.totalValor / totalValorGeral) * 100;
                if (pct > fatiaUniforme * 2 && pct > 20 && !alertas.some(a => a.titulo.includes(p.produto))) {
                    alertas.push({
                        icone: 'fa-sack-dollar',
                        titulo: `${p.produto} concentra grande parte do valor perdido`,
                        detalhe: `${pct.toFixed(1)}% do valor total de quebras do período (${formatMoeda(p.totalValor)})`
                    });
                }
            });
        }

        if (porDia.length >= 4) {
            const meio = Math.floor(porDia.length / 2);
            const somarKgPorProduto = (dias) => {
                const mapa = {};
                dias.forEach(d => d.resumo.porProduto.forEach(p => {
                    mapa[p.codigo] = (mapa[p.codigo] || 0) + p.totalKg;
                }));
                return mapa;
            };
            const antes = somarKgPorProduto(porDia.slice(0, meio));
            const depois = somarKgPorProduto(porDia.slice(meio));
            porProduto.forEach(p => {
                const antesKg = antes[p.codigo] || 0;
                const depoisKg = depois[p.codigo] || 0;
                if (antesKg > 0 && depoisKg > antesKg * 1.5 && (depoisKg - antesKg) > 0.5 && !alertas.some(a => a.titulo.includes(p.produto))) {
                    alertas.push({
                        icone: 'fa-chart-line',
                        titulo: `${p.produto} aumentou na segunda metade do período`,
                        detalhe: `De ${formatPeso(antesKg)} para ${formatPeso(depoisKg)}, comparando a 1ª com a 2ª metade do intervalo`
                    });
                }
            });
        }

        return alertas.slice(0, 5);
    }

    function renderDashAtencao(alertas) {
        const wrap = document.getElementById('dashAtencaoWrap');
        const container = document.getElementById('dashAtencao');
        if (!wrap || !container) return;
        if (!alertas.length) {
            wrap.style.display = 'none';
            return;
        }
        wrap.style.display = '';
        let html = '<div class="dash-alertas-list">';
        alertas.forEach(a => {
            html += `
                <div class="dash-alerta-item">
                    <span class="dash-alerta-icon"><i class="fas ${a.icone}"></i></span>
                    <span class="dash-alerta-body">
                        <span class="dash-alerta-titulo">${a.titulo}</span>
                        <span class="dash-alerta-detalhe">${a.detalhe}</span>
                    </span>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // ===== PARTICIPAÇÃO DOS PRODUTOS (donut) =====
    function renderDashParticipacao(porProduto) {
        const wrap = document.getElementById('dashParticipacaoWrap');
        const container = document.getElementById('dashParticipacao');
        if (!wrap || !container) return;
        const totalKg = porProduto.reduce((s, p) => s + p.totalKg, 0);
        if (porProduto.length < 4 || totalKg <= 0) {
            wrap.style.display = 'none';
            return;
        }
        wrap.style.display = '';
        const ordenado = porProduto.slice().sort((a, b) => b.totalKg - a.totalKg);
        const top = ordenado.slice(0, 4);
        const outrosKg = ordenado.slice(4).reduce((s, p) => s + p.totalKg, 0);
        const fatias = top.map(p => ({ nome: p.produto, kg: p.totalKg }));
        if (outrosKg > 0) fatias.push({ nome: 'Outros', kg: outrosKg });

        const cores = ['#1a4972', '#2f7fb8', '#5aa9d6', '#9a6700', '#94a0b3'];
        const raio = 52, cx = 70, cy = 70, circunferencia = 2 * Math.PI * raio;
        let acumulado = 0;
        let circulosHtml = '';
        fatias.forEach((f, i) => {
            const pct = f.kg / totalKg;
            const comprimento = pct * circunferencia;
            circulosHtml += `<circle cx="${cx}" cy="${cy}" r="${raio}" fill="none" stroke="${cores[i % cores.length]}" stroke-width="22" stroke-dasharray="${comprimento.toFixed(1)} ${(circunferencia - comprimento).toFixed(1)}" stroke-dashoffset="${(-acumulado).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"><title>${f.nome}: ${(pct * 100).toFixed(1)}%</title></circle>`;
            acumulado += comprimento;
        });
        const legendaHtml = fatias.map((f, i) => `
            <span class="dash-legenda-item">
                <span class="dash-legenda-cor" style="background:${cores[i % cores.length]}"></span>
                ${f.nome} — ${((f.kg / totalKg) * 100).toFixed(1)}%
            </span>
        `).join('');
        container.innerHTML = `
            <div class="dash-participacao-wrap">
                <svg viewBox="0 0 140 140" class="dash-donut-svg">${circulosHtml}</svg>
                <div class="dash-legenda-list">${legendaHtml}</div>
            </div>
        `;
    }

    // ===== RELATÓRIOS RECENTES (acesso rápido, sem substituir o histórico) =====
    function renderDashRelatoriosRecentes(lista) {
        const container = document.getElementById('dashRelatoriosRecentes');
        if (!container) return;
        const recentes = lista.slice(0, 5);
        if (!recentes.length) {
            container.innerHTML = `
                <div class="empty-state dash-empty">
                    <span class="empty-icon"><i class="fas fa-file-alt"></i></span>
                    <p>Nenhum relatório salvo ainda.</p>
                    <p class="empty-sub">Gere relatórios na aba "Relatórios" para vê-los aqui.</p>
                </div>
            `;
            return;
        }
        let html = '<div class="dash-relatorios-list">';
        recentes.forEach(rel => {
            html += `
                <div class="dash-relatorio-item">
                    <span class="dr-periodo"><i class="fas fa-calendar-week"></i> ${rel.periodoLabel}</span>
                    <span class="dr-totais">
                        <span>${rel.totalRegistros} reg.</span>
                        <span>${formatPeso(rel.totalPesoKg)}</span>
                        <strong>${formatMoeda(rel.totalValor)}</strong>
                    </span>
                    <span class="dr-actions">
                        <button type="button" class="btn btn-sm btn-outline dr-ver" data-id="${rel.id}" title="Visualizar"><i class="fas fa-eye"></i></button>
                        <button type="button" class="btn btn-sm btn-outline dr-pdf" data-id="${rel.id}" title="PDF"><i class="fas fa-file-pdf"></i></button>
                    </span>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.dr-ver').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const rel = dashCacheRelatorios.find(r => r.id === id);
                navegarPara('relatorios');
                if (rel) exibirResumoSalvo(rel);
            });
        });
        container.querySelectorAll('.dr-pdf').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const rel = dashCacheRelatorios.find(r => r.id === id);
                if (rel) exportarPDFRelatorioSalvo(rel);
            });
        });
    }

    // ===== CARREGAR / RECALCULAR O DASHBOARD =====
    async function carregarDashboard() {
        try {
            const todos = await obterTodosRegistros();

            // Popular filtro de produtos a partir dos registros existentes (sem duplicar fonte de dados)
            const selectProduto = document.getElementById('dashProdutoFiltro');
            if (selectProduto) {
                const selecionadoAtual = selectProduto.value;
                const produtosUnicos = {};
                todos.forEach(r => { produtosUnicos[r.codigo] = r.produto; });
                const opcoes = Object.keys(produtosUnicos)
                    .sort((a, b) => produtosUnicos[a].localeCompare(produtosUnicos[b]))
                    .map(cod => `<option value="${cod}">${cod} — ${produtosUnicos[cod]}</option>`)
                    .join('');
                selectProduto.innerHTML = `<option value="">Todos os produtos</option>${opcoes}`;
                if (selecionadoAtual && produtosUnicos[selecionadoAtual]) {
                    selectProduto.value = selecionadoAtual;
                }
            }

            const dataIniInput = document.getElementById('dashDataInicial');
            const dataFimInput = document.getElementById('dashDataFinal');
            if (dataIniInput && dataFimInput && (!dataIniInput.value || !dataFimInput.value)) {
                const hoje = new Date();
                const inicioPadrao = new Date(hoje);
                inicioPadrao.setDate(inicioPadrao.getDate() - 6);
                dataIniInput.value = inicioPadrao.toISOString().slice(0, 10);
                dataFimInput.value = hoje.toISOString().slice(0, 10);
            }

            const dataIni = dataIniInput ? dataIniInput.value : '';
            const dataFim = dataFimInput ? dataFimInput.value : '';
            const produtoSel = selectProduto ? selectProduto.value : '';

            const filtrados = filtrarRegistrosDashboard(todos, dataIni, dataFim, produtoSel);
            const resumo = calcularResumoRelatorio(filtrados);
            const porDia = agruparRegistrosPorDia(filtrados).map(dia => ({
                chaveDia: dia.chaveDia,
                periodoLabel: dia.periodoLabel,
                resumo: calcularResumoRelatorio(dia.registros)
            }));

            dashCacheResumo = resumo;
            dashCachePorDia = porDia;
            dashCacheRelatorios = await obterRelatoriosSalvos();

            renderDashKpis(resumo);
            renderDashRanking(resumo.porProduto, dashSortRanking);
            renderDashBarChart(resumo.porProduto, dashVerTodosBarras);
            renderDashTendencia(porDia, dashMetricaTendencia);
            renderDashPeriodos(porDia);
            renderDashAtencao(calcularAlertasDashboard(resumo.porProduto, porDia));
            renderDashParticipacao(resumo.porProduto);
            renderDashRelatoriosRecentes(dashCacheRelatorios);
        } catch (e) {
            console.error('Erro ao carregar dashboard:', e);
        }
    }

    // ===== EVENTOS DO DASHBOARD (registrados uma única vez) =====
    function inicializarEventosDashboard() {
        const btnAplicar = document.getElementById('btnDashAplicar');
        const btnLimpar = document.getElementById('btnDashLimpar');
        const selectProduto = document.getElementById('dashProdutoFiltro');
        const btnVerTodosRelatorios = document.getElementById('btnDashVerTodosRelatorios');
        const btnVerTodosBarras = document.getElementById('btnDashVerTodosBarras');

        if (btnAplicar) btnAplicar.addEventListener('click', carregarDashboard);
        if (btnLimpar) {
            btnLimpar.addEventListener('click', () => {
                document.getElementById('dashDataInicial').value = '';
                document.getElementById('dashDataFinal').value = '';
                if (selectProduto) selectProduto.value = '';
                carregarDashboard();
            });
        }
        if (selectProduto) selectProduto.addEventListener('change', carregarDashboard);
        if (btnVerTodosRelatorios) btnVerTodosRelatorios.addEventListener('click', () => navegarPara('relatorios'));
        if (btnVerTodosBarras) {
            btnVerTodosBarras.addEventListener('click', () => {
                dashVerTodosBarras = !dashVerTodosBarras;
                if (dashCacheResumo) renderDashBarChart(dashCacheResumo.porProduto, dashVerTodosBarras);
            });
        }

        document.querySelectorAll('#dashRankingToggle .dash-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#dashRankingToggle .dash-toggle').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                dashSortRanking = btn.dataset.sort;
                if (dashCacheResumo) renderDashRanking(dashCacheResumo.porProduto, dashSortRanking);
            });
        });

        document.querySelectorAll('#dashTendenciaToggle .dash-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#dashTendenciaToggle .dash-toggle').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                dashMetricaTendencia = btn.dataset.metrica;
                if (dashCachePorDia) renderDashTendencia(dashCachePorDia, dashMetricaTendencia);
            });
        });
    }

    // ===== NAVEGAÇÃO =====
    function navegarPara(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + pageId).classList.add('active');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.nav-btn[data-page="${pageId}"]`).classList.add('active');
        if (pageId === 'registros') {
            carregarListaRegistros();
        }
        if (pageId === 'configuracoes') {
            atualizarContador();
            calcularTamanhoArmazenamento();
            renderizarProdutos();
        }
        if (pageId === 'relatorios') {
            const hoje = new Date();
            const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            document.getElementById('relDataInicial').value = inicio.toISOString().slice(0,10);
            document.getElementById('relDataFinal').value = hoje.toISOString().slice(0,10);
            renderHistoricoRelatorios();
        }
        if (pageId === 'dashboard') {
            carregarDashboard();
        }
    }

    async function calcularTamanhoArmazenamento() {
        try {
            const registros = await obterTodosRegistros();
            let totalBytes = 0;
            registros.forEach(r => {
                totalBytes += JSON.stringify(r).length;
                if (r.foto) totalBytes += r.foto.length * 0.75;
            });
            let sizeStr = '0 KB';
            if (totalBytes > 1024 * 1024) {
                sizeStr = (totalBytes / (1024 * 1024)).toFixed(1) + ' MB';
            } else if (totalBytes > 1024) {
                sizeStr = (totalBytes / 1024).toFixed(0) + ' KB';
            } else {
                sizeStr = totalBytes + ' bytes';
            }
            document.getElementById('configStorageSize').textContent = sizeStr;
        } catch (e) {
            console.error(e);
        }
    }

    // ===== INICIALIZAÇÃO =====
    document.addEventListener('DOMContentLoaded', async function() {
        try {
            await abrirDB();
            console.log('IndexedDB pronto.');

            // Inicializar produtos se vazio
            const produtosExistentes = await obterTodosProdutos();
            if (produtosExistentes.length === 0 && typeof produtosIniciais !== 'undefined') {
                // Importar dados do base_produtos.js
                for (const p of produtosIniciais) {
                    try {
                        await adicionarProduto(String(p.CÓDIGO), p.PRODUTO);
                    } catch (e) {
                        console.warn('Erro ao adicionar produto inicial:', p, e);
                    }
                }
                console.log('Base de produtos inicializada.');
            }

            await carregarListaRegistros();
            await atualizarContador();
            await carregarDashboard();
            inicializarEventosDashboard();

            // Navegação
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const page = btn.dataset.page;
                    navegarPara(page);
                });
            });

            // ===== FORMULÁRIO DE REGISTRO =====
            const form = document.getElementById('formQuebra');

            function calcularTotal() {
                const pesoStr = document.getElementById('peso').value.trim().replace(',', '.');
                const valorStr = document.getElementById('valorKg').value.trim().replace(',', '.');
                const peso = parseFloat(pesoStr) || 0;
                const valor = parseFloat(valorStr) || 0;
                const total = peso * valor;
                document.getElementById('totalDisplay').textContent = formatMoeda(total);
                return total;
            }

            document.getElementById('peso').addEventListener('input', calcularTotal);
            document.getElementById('valorKg').addEventListener('input', calcularTotal);

            // Foto
            document.getElementById('btnArquivo').addEventListener('click', () => {
                document.getElementById('fileInput').click();
            });
            document.getElementById('fileInput').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) processarFoto(file);
            });
            document.getElementById('btnCamera').addEventListener('click', () => {
                document.getElementById('cameraInput').click();
            });
            document.getElementById('cameraInput').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) processarFoto(file);
            });
            document.getElementById('btnGaleria').addEventListener('click', () => {
                document.getElementById('fileInput').click();
            });

            function processarFoto(file) {
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    currentFotoBase64 = ev.target.result;
                    const img = document.getElementById('fotoImg');
                    img.src = currentFotoBase64;
                    img.style.display = 'block';
                    document.querySelector('#fotoPreview .foto-placeholder').style.display = 'none';
                    document.getElementById('btnRemoverFoto').style.display = 'inline-flex';
                };
                reader.readAsDataURL(file);
            }

            document.getElementById('btnRemoverFoto').addEventListener('click', () => {
                currentFotoBase64 = null;
                document.getElementById('fotoImg').style.display = 'none';
                document.getElementById('fotoImg').src = '';
                document.querySelector('#fotoPreview .foto-placeholder').style.display = 'block';
                document.getElementById('btnRemoverFoto').style.display = 'none';
                document.getElementById('fileInput').value = '';
                document.getElementById('cameraInput').value = '';
            });

            document.getElementById('btnLimpar').addEventListener('click', () => {
                form.reset();
                document.getElementById('totalDisplay').textContent = 'R$ 0,00';
                currentFotoBase64 = null;
                document.getElementById('fotoImg').style.display = 'none';
                document.querySelector('#fotoPreview .foto-placeholder').style.display = 'block';
                document.getElementById('btnRemoverFoto').style.display = 'none';
                document.getElementById('fileInput').value = '';
                document.getElementById('cameraInput').value = '';
                document.getElementById('produtoSugestao').style.display = 'none';
            });

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const codigo = document.getElementById('codigo').value.trim();
                const produto = document.getElementById('produto').value.trim();
                const pesoStr = document.getElementById('peso').value.trim().replace(',', '.');
                const valorStr = document.getElementById('valorKg').value.trim().replace(',', '.');
                const observacao = document.getElementById('observacao').value.trim();
                if (!codigo) { alert('Código é obrigatório.'); return; }
                if (!produto) { alert('Produto é obrigatório.'); return; }
                const peso = parseFloat(pesoStr);
                if (!peso || peso <= 0) { alert('Peso deve ser maior que zero.'); return; }
                const valorKg = parseFloat(valorStr);
                if (isNaN(valorKg) || valorKg < 0) { alert('Valor/kg inválido.'); return; }
                const total = peso * valorKg;

                document.getElementById('confCodigo').textContent = codigo;
                document.getElementById('confProduto').textContent = produto;
                document.getElementById('confPeso').textContent = formatPeso(peso);
                document.getElementById('confValorKg').textContent = formatMoeda(valorKg);
                document.getElementById('confTotal').textContent = formatMoeda(total);
                document.getElementById('confObservacao').textContent = observacao || '—';
                document.getElementById('confFoto').textContent = currentFotoBase64 ? '✓ Anexada' : '✗ Não anexada';

                window._registroPendente = {
                    codigo, produto, peso, valorKg, total, observacao, foto: currentFotoBase64
                };
                document.getElementById('modalConfirmacao').classList.add('active');
            });

            document.getElementById('btnConfirmarSalvar').addEventListener('click', async () => {
                const dados = window._registroPendente;
                if (!dados) return;
                try {
                    const agora = new Date();
                    const registro = {
                        data: formatDate(agora),
                        hora: formatTime(agora),
                        dataHora: agora.toISOString(),
                        codigo: dados.codigo,
                        produto: dados.produto,
                        pesoKg: dados.peso,
                        valorKg: dados.valorKg,
                        valorTotal: dados.total,
                        foto: dados.foto || null,
                        observacao: dados.observacao || '',
                        criadoEm: agora.toISOString(),
                        atualizadoEm: agora.toISOString()
                    };
                    const id = await adicionarRegistro(registro);
                    document.getElementById('modalConfirmacao').classList.remove('active');
                    document.getElementById('sucessoId').textContent = 'ID: ' + gerarIdDisplay(id);
                    document.getElementById('modalSucesso').classList.add('active');
                    document.getElementById('btnLimpar').click();
                    await carregarListaRegistros();
                    await atualizarContador();
                    window._registroPendente = null;
                } catch (e) {
                    alert('Erro ao salvar registro.');
                    console.error(e);
                }
            });

            // ===== PESQUISA E FILTROS =====
            document.getElementById('searchInput').addEventListener('input', () => {
                carregarListaRegistros();
            });
            document.getElementById('periodoFilter').addEventListener('change', function() {
                const custom = document.getElementById('periodoCustom');
                if (this.value === 'personalizado') {
                    custom.style.display = 'block';
                } else {
                    custom.style.display = 'none';
                    carregarListaRegistros();
                }
            });
            document.getElementById('btnAplicarPeriodo').addEventListener('click', () => {
                carregarListaRegistros();
            });
            document.getElementById('btnLoadMore').addEventListener('click', () => {
                const nextPage = (currentPage + 1) * PAGE_SIZE;
                carregarListaRegistros(nextPage);
            });

            // ===== DETALHE - EDIÇÃO E EXCLUSÃO =====
            document.getElementById('btnEditarRegistro').addEventListener('click', async () => {
                if (!currentViewId) return;
                await abrirEdicao(currentViewId);
                document.getElementById('modalDetalhe').classList.remove('active');
            });
            document.getElementById('btnExcluirRegistro').addEventListener('click', () => {
                if (!currentViewId) return;
                document.getElementById('excluirId').textContent = gerarIdDisplay(currentViewId);
                document.getElementById('modalExcluir').classList.add('active');
                document.getElementById('modalDetalhe').classList.remove('active');
            });

            // ===== EDIÇÃO =====
            async function abrirEdicao(id) {
                try {
                    const reg = await obterRegistroPorId(id);
                    if (!reg) return;
                    currentEditId = id;
                    document.getElementById('editId').value = id;
                    document.getElementById('editCodigo').value = reg.codigo;
                    document.getElementById('editProduto').value = reg.produto;
                    document.getElementById('editPeso').value = pesoParaInput(reg.pesoKg);
                    document.getElementById('editValorKg').value = valorParaInput(reg.valorKg);
                    document.getElementById('editObservacao').value = reg.observacao || '';
                    document.getElementById('editTotalDisplay').textContent = formatMoeda(reg.valorTotal);

                    if (reg.foto && reg.foto.length > 0) {
                        currentEditFotoBase64 = reg.foto;
                        document.getElementById('editFotoImg').src = reg.foto;
                        document.getElementById('editFotoImg').style.display = 'block';
                        document.getElementById('editFotoPlaceholder').style.display = 'none';
                    } else {
                        currentEditFotoBase64 = null;
                        document.getElementById('editFotoImg').style.display = 'none';
                        document.getElementById('editFotoPlaceholder').style.display = 'block';
                    }

                    function calcEditTotal() {
                        const p = parseFloat(document.getElementById('editPeso').value.replace(',', '.')) || 0;
                        const v = parseFloat(document.getElementById('editValorKg').value.replace(',', '.')) || 0;
                        document.getElementById('editTotalDisplay').textContent = formatMoeda(p * v);
                    }
                    document.getElementById('editPeso').addEventListener('input', calcEditTotal);
                    document.getElementById('editValorKg').addEventListener('input', calcEditTotal);

                    document.getElementById('editBtnArquivo').addEventListener('click', () => {
                        document.getElementById('editFileInput').click();
                    });
                    document.getElementById('editFileInput').addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                currentEditFotoBase64 = ev.target.result;
                                document.getElementById('editFotoImg').src = currentEditFotoBase64;
                                document.getElementById('editFotoImg').style.display = 'block';
                                document.getElementById('editFotoPlaceholder').style.display = 'none';
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                    document.getElementById('editBtnRemoverFoto').addEventListener('click', () => {
                        currentEditFotoBase64 = null;
                        document.getElementById('editFotoImg').style.display = 'none';
                        document.getElementById('editFotoPlaceholder').style.display = 'block';
                        document.getElementById('editFileInput').value = '';
                    });

                    document.getElementById('modalEdicao').classList.add('active');
                } catch (e) {
                    alert('Erro ao carregar registro para edição.');
                    console.error(e);
                }
            }

            document.getElementById('btnSalvarEdicao').addEventListener('click', async () => {
                const id = parseInt(document.getElementById('editId').value);
                const codigo = document.getElementById('editCodigo').value.trim();
                const produto = document.getElementById('editProduto').value.trim();
                const pesoStr = document.getElementById('editPeso').value.trim().replace(',', '.');
                const valorStr = document.getElementById('editValorKg').value.trim().replace(',', '.');
                const observacao = document.getElementById('editObservacao').value.trim();
                if (!codigo || !produto) { alert('Código e produto são obrigatórios.'); return; }
                const peso = parseFloat(pesoStr);
                if (!peso || peso <= 0) { alert('Peso inválido.'); return; }
                const valorKg = parseFloat(valorStr);
                if (isNaN(valorKg) || valorKg < 0) { alert('Valor/kg inválido.'); return; }
                const total = peso * valorKg;

                try {
                    const reg = await obterRegistroPorId(id);
                    if (!reg) { alert('Registro não encontrado.'); return; }
                    const atualizado = {
                        ...reg,
                        codigo,
                        produto,
                        pesoKg: peso,
                        valorKg: valorKg,
                        valorTotal: total,
                        foto: currentEditFotoBase64 || null,
                        observacao: observacao || '',
                        atualizadoEm: new Date().toISOString()
                    };
                    await atualizarRegistro(id, atualizado);
                    document.getElementById('modalEdicao').classList.remove('active');
                    alert('Registro atualizado com sucesso!');
                    await carregarListaRegistros();
                    await atualizarContador();
                } catch (e) {
                    alert('Erro ao salvar edição.');
                    console.error(e);
                }
            });

            // ===== EXCLUSÃO DE REGISTRO =====
            document.getElementById('btnConfirmarExcluir').addEventListener('click', async () => {
                const id = parseInt(document.getElementById('excluirId').textContent.replace('#', ''));
                if (!id) return;
                try {
                    await excluirRegistro(id);
                    document.getElementById('modalExcluir').classList.remove('active');
                    alert('Registro excluído com sucesso.');
                    await carregarListaRegistros();
                    await atualizarContador();
                } catch (e) {
                    alert('Erro ao excluir registro.');
                    console.error(e);
                }
            });

            // ===== FECHAR MODAIS =====
            document.querySelectorAll('[data-close]').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.close;
                    document.getElementById(id).classList.remove('active');
                });
            });
            document.querySelectorAll('.modal-overlay').forEach(overlay => {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) overlay.classList.remove('active');
                });
            });

            // ===== RELATÓRIOS =====
            document.getElementById('btnGerarRelatorio').addEventListener('click', gerarRelatorio);
            document.getElementById('btnImprimirRelatorio').addEventListener('click', imprimirRelatorio);

            document.getElementById('btnExportarCSV').addEventListener('click', async () => {
                const dataIni = document.getElementById('relDataInicial').value;
                const dataFim = document.getElementById('relDataFinal').value;
                if (!dataIni || !dataFim) { alert('Selecione o período.'); return; }
                try {
                    const todos = await obterTodosRegistros();
                    const inicio = new Date(dataIni + 'T00:00:00');
                    const fim = new Date(dataFim + 'T23:59:59');
                    const filtrados = todos.filter(r => {
                        const d = new Date(r.dataHora);
                        return d >= inicio && d <= fim;
                    });
                    if (filtrados.length === 0) { alert('Nenhum registro no período.'); return; }
                    exportarCSV(filtrados);
                } catch (e) {
                    alert('Erro ao exportar CSV.');
                    console.error(e);
                }
            });

            document.getElementById('btnExportarPDF').addEventListener('click', async () => {
                const dataIni = document.getElementById('relDataInicial').value;
                const dataFim = document.getElementById('relDataFinal').value;
                if (!dataIni || !dataFim) { alert('Selecione o período.'); return; }
                try {
                    const todos = await obterTodosRegistros();
                    const inicio = new Date(dataIni + 'T00:00:00');
                    const fim = new Date(dataFim + 'T23:59:59');
                    const noIntervalo = todos.filter(r => {
                        const d = new Date(r.dataHora);
                        return d >= inicio && d <= fim;
                    });
                    if (noIntervalo.length === 0) { alert('Nenhum registro no período.'); return; }

                    // Cada dia do intervalo vira um bloco separado no PDF — nunca um único
                    // relatório somando o intervalo inteiro.
                    const porDia = agruparRegistrosPorDia(noIntervalo);
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF('landscape', 'mm', 'a4');
                    porDia.forEach((dia, idx) => {
                        if (idx > 0) doc.addPage();
                        const resumo = calcularResumoRelatorio(dia.registros);
                        desenharBlocoRelatorioPDF(doc, dia.periodoLabel, resumo);
                    });
                    doc.save(`relatorio_quebras_${new Date().toISOString().slice(0,10)}.pdf`);
                } catch (e) {
                    alert('Erro ao gerar PDF.');
                    console.error(e);
                }
            });

            const btnPdfCompleto = document.getElementById('btnPdfCompleto');
            if (btnPdfCompleto) {
                btnPdfCompleto.addEventListener('click', exportarPDFCompleto);
            }

            // ===== CONFIGURAÇÕES =====
            document.getElementById('btnExportarBackup').addEventListener('click', exportarBackup);
            document.getElementById('btnRestaurarBackup').addEventListener('click', () => {
                document.getElementById('modalRestaurar').classList.add('active');
            });
            document.getElementById('btnConfirmarRestaurar').addEventListener('click', () => {
                const fileInput = document.getElementById('restoreFileInput');
                if (fileInput.files.length === 0) {
                    alert('Selecione um arquivo de backup.');
                    return;
                }
                restaurarBackup(fileInput.files[0]);
                document.getElementById('modalRestaurar').classList.remove('active');
                fileInput.value = '';
            });
            document.getElementById('btnExportarDados').addEventListener('click', exportarDados);
            document.getElementById('btnLimparDados').addEventListener('click', () => {
                document.getElementById('modalLimparDados').classList.add('active');
            });
            document.getElementById('btnConfirmarLimpar').addEventListener('click', async () => {
                try {
                    await limparTodosRegistros();
                    document.getElementById('modalLimparDados').classList.remove('active');
                    alert('Todos os dados foram removidos.');
                    await carregarListaRegistros();
                    await atualizarContador();
                } catch (e) {
                    alert('Erro ao limpar dados.');
                    console.error(e);
                }
            });

            // ===== INICIALIZAR RELATÓRIOS COM DATAS PADRÃO =====
            const hoje = new Date();
            const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            document.getElementById('relDataInicial').value = primeiroDia.toISOString().slice(0,10);
            document.getElementById('relDataFinal').value = hoje.toISOString().slice(0,10);

        } catch (e) {
            console.error('Erro na inicialização:', e);
            alert('Erro ao inicializar o sistema. Verifique se seu navegador suporta IndexedDB.');
        }
    });

})();