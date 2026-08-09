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
    function exportarPDF(registros, periodoLabel) {
        if (!registros || registros.length === 0) {
            alert('Nenhum registro para gerar PDF.');
            return;
        }

        const resumo = calcularResumoRelatorio(registros);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let y = margin;

        // Título
        doc.setFontSize(16);
        doc.setTextColor(26, 73, 114);
        doc.text('REGISTRO DE QUEBRAS — PADARIA', pageWidth / 2, y, { align: 'center' });
        y += 8;
        doc.setFontSize(11);
        doc.setTextColor(60, 70, 80);
        doc.text(`Período: ${periodoLabel}`, pageWidth / 2, y, { align: 'center' });
        y += 10;

        // Caixas de resumo
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
        y += 24;

        // Para cada produto, uma seção com subtítulo e tabela de registros
        resumo.porProduto.forEach((p, idx) => {
            // Verificar se cabe na página, senão quebrar
            if (y > 180) {
                doc.addPage();
                y = margin + 10;
            }

            doc.setFontSize(11);
            doc.setTextColor(26, 73, 114);
            doc.text(`Produto: ${p.codigo} - ${p.produto}`, margin, y);
            y += 5;
            doc.setFontSize(9);
            doc.setTextColor(60);
            doc.text(`Registros: ${p.qtd}  |  Total Kg: ${formatPeso(p.totalKg)}  |  Total R$: ${formatMoeda(p.totalValor)}`, margin, y);
            y += 6;

            // Cabeçalho da tabela de registros do produto
            const headers = ['ID', 'Data', 'Hora', 'Peso', 'Valor/kg', 'Total', 'Obs.'];
            const colWidths = [16, 22, 16, 22, 22, 22, 30];
            let x = margin;
            doc.setFontSize(8);
            doc.setTextColor(40);
            doc.setFillColor(240, 244, 248);
            doc.rect(margin, y - 4, pageWidth - 2 * margin, 7, 'F');
            headers.forEach((h, i) => {
                doc.text(h, x + 1, y + 1);
                x += colWidths[i];
            });
            y += 7;

            // Linhas
            doc.setTextColor(0);
            p.registros.forEach(r => {
                const d = new Date(r.dataHora);
                const row = [
                    String(r.id),
                    formatDate(d),
                    formatTime(d),
                    formatPeso(r.pesoKg),
                    formatMoeda(r.valorKg),
                    formatMoeda(r.valorTotal),
                    (r.observacao || '').slice(0, 12)
                ];
                x = margin;
                row.forEach((cell, i) => {
                    doc.text(String(cell), x + 1, y + 1);
                    x += colWidths[i];
                });
                y += 6;
                if (y > 190) {
                    // quebra de página dentro do produto
                    doc.addPage();
                    y = margin + 10;
                    // reimprimir cabeçalho da tabela
                    doc.setFillColor(240, 244, 248);
                    doc.rect(margin, y - 4, pageWidth - 2 * margin, 7, 'F');
                    x = margin;
                    headers.forEach((h, i) => {
                        doc.text(h, x + 1, y + 1);
                        x += colWidths[i];
                    });
                    y += 7;
                }
            });

            // Linha de subtotal do produto
            doc.setFontSize(8);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(26, 73, 114);
            x = margin;
            doc.text('SUBTOTAL', x + 1, y + 1);
            x += colWidths[0] + colWidths[1] + colWidths[2];
            doc.text(formatPeso(p.totalKg), x + 1, y + 1);
            x += colWidths[3] + colWidths[4];
            doc.text(formatMoeda(p.totalValor), x + 1, y + 1);
            doc.setFont(undefined, 'normal');
            y += 8;

            // Linha separadora entre produtos
            doc.setDrawColor(200);
            doc.line(margin, y - 2, pageWidth - margin, y - 2);
            y += 4;
        });

        // Rodapé geral
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Total geral: ${registros.length} registros`, margin, y + 6);
        doc.text(`Gerado em ${formatDateTime(new Date())}`, pageWidth - margin, y + 6, { align: 'right' });

        doc.save(`relatorio_quebras_${new Date().toISOString().slice(0,10)}.pdf`);
    }

    // ===== RENDERIZAR RESUMO (stats + total por produto) =====
    function renderResumoHtml(totalRegistros, totalPesoKg, totalValor, porProduto) {
        let linhas = '';
        porProduto.forEach(p => {
            const pct = totalValor > 0 ? ((p.totalValor / totalValor) * 100).toFixed(1) : '0.0';
            linhas += `<tr>
                <td>${p.codigo}</td>
                <td>${p.produto}</td>
                <td class="num">${p.qtd}</td>
                <td class="num">${formatPeso(p.totalKg)}</td>
                <td class="num">${formatMoeda(p.totalValor)}</td>
                <td class="num">${pct}%</td>
            </tr>`;
        });
        return `
            <div class="rel-stats">
                <div class="rel-stat">
                    <span class="rel-stat-label"><i class="fas fa-list-ol"></i> Registros</span>
                    <span class="rel-stat-value">${totalRegistros}</span>
                </div>
                <div class="rel-stat">
                    <span class="rel-stat-label"><i class="fas fa-weight-scale"></i> Total em Kg</span>
                    <span class="rel-stat-value">${formatPeso(totalPesoKg)}</span>
                </div>
                <div class="rel-stat rel-stat-primary">
                    <span class="rel-stat-label"><i class="fas fa-sack-dollar"></i> Total em R$</span>
                    <span class="rel-stat-value">${formatMoeda(totalValor)}</span>
                </div>
            </div>
            <div class="rel-section">
                <div class="rel-section-header-row">
                    <span class="rel-section-title"><i class="fas fa-layer-group"></i> Total por Produto</span>
                </div>
                <table class="relatorio-tabela rel-breakdown-tabela">
                    <thead><tr>
                        <th>Código</th><th>Produto</th><th class="num">Registros</th>
                        <th class="num">Total Kg</th><th class="num">Total R$</th><th class="num">% valor</th>
                    </tr></thead>
                    <tbody>${linhas}</tbody>
                    <tfoot><tr>
                        <td colspan="2">TOTAL GERAL</td>
                        <td class="num">${totalRegistros}</td>
                        <td class="num">${formatPeso(totalPesoKg)}</td>
                        <td class="num">${formatMoeda(totalValor)}</td>
                        <td class="num">100%</td>
                    </tr></tfoot>
                </table>
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
        container.innerHTML = `
            <p class="rel-snapshot-note"><i class="fas fa-clock-rotate-left"></i> Visualizando relatório salvo de <strong>${rel.periodoLabel}</strong> (período individual, sem acúmulo com outros períodos).</p>
            ${renderResumoHtml(rel.totalRegistros, rel.totalPesoKg, rel.totalValor, rel.porProduto)}
        `;
        window._relatorioData = null;
        window._relatorioPeriodo = rel.periodoLabel;
        window._relatorioResumo = rel;
        document.getElementById('relDataInicial').value = rel.periodoInicio;
        document.getElementById('relDataFinal').value = rel.periodoFim;
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ===== GERAR RELATÓRIO (visualização) =====
    async function gerarRelatorio() {
        const dataIni = document.getElementById('relDataInicial').value;
        const dataFim = document.getElementById('relDataFinal').value;
        if (!dataIni || !dataFim) {
            alert('Selecione o período inicial e final.');
            return;
        }
        try {
            const todos = await obterTodosRegistros();
            const inicio = new Date(dataIni + 'T00:00:00');
            const fim = new Date(dataFim + 'T23:59:59');
            const filtrados = todos.filter(r => {
                const d = new Date(r.dataHora);
                return d >= inicio && d <= fim;
            });
            const container = document.getElementById('relatorioResultado');
            if (filtrados.length === 0) {
                container.innerHTML = `<div class="empty-state"><span class="empty-icon"><i class="fas fa-inbox"></i></span><p>Nenhum registro no período selecionado.</p></div>`;
                window._relatorioData = null;
                window._relatorioResumo = null;
                return;
            }

            const resumo = calcularResumoRelatorio(filtrados);
            const periodoLabel = `${formatDate(inicio)} a ${formatDate(fim)}`;

            let detalheHtml = `<table class="relatorio-tabela"><thead><tr>
                <th>ID</th><th>Data</th><th>Hora</th><th>Código</th><th>Produto</th>
                <th class="num">Peso</th><th class="num">Valor/kg</th><th class="num">Total</th><th>Obs.</th>
            </tr></thead><tbody>`;
            filtrados.forEach(r => {
                const d = new Date(r.dataHora);
                detalheHtml += `<tr>
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
            detalheHtml += `</tbody></table>`;

            container.innerHTML = `
                ${renderResumoHtml(resumo.totalRegistros, resumo.totalPesoKg, resumo.totalValor, resumo.porProduto)}
                <div class="rel-section">
                    <div class="rel-section-header-row">
                        <span class="rel-section-title"><i class="fas fa-list"></i> Registros Detalhados</span>
                        <button type="button" class="btn btn-sm btn-outline no-print" id="btnToggleDetalhe"><i class="fas fa-chevron-down"></i> Mostrar/ocultar</button>
                    </div>
                    <div class="rel-detail-wrap hidden" id="relDetalheWrap">${detalheHtml}</div>
                </div>
                <p class="rel-footer-note"><i class="fas fa-check-circle"></i> Relatório salvo no histórico — este período é individual e não acumula com outros.</p>
            `;
            const btnToggle = document.getElementById('btnToggleDetalhe');
            if (btnToggle) {
                btnToggle.addEventListener('click', () => {
                    document.getElementById('relDetalheWrap').classList.toggle('hidden');
                });
            }

            window._relatorioData = filtrados;
            window._relatorioPeriodo = periodoLabel;
            window._relatorioResumo = resumo;

            await salvarRelatorio(resumo, dataIni, dataFim, periodoLabel);
            renderHistoricoRelatorios();
        } catch (e) {
            alert('Erro ao gerar relatório.');
            console.error(e);
        }
    }

    // ===== IMPRIMIR RELATÓRIO =====
    function imprimirRelatorio() {
        const resumo = window._relatorioResumo;
        if (!resumo) {
            alert('Gere o relatório primeiro.');
            return;
        }
        const periodo = window._relatorioPeriodo || (document.getElementById('relDataInicial').value + ' a ' + document.getElementById('relDataFinal').value);
        const registros = window._relatorioData;

        let linhasBreak = '';
        resumo.porProduto.forEach(p => {
            const pct = resumo.totalValor > 0 ? ((p.totalValor / resumo.totalValor) * 100).toFixed(1) + '%' : '0,0%';
            linhasBreak += `<tr>
                <td>${p.codigo}</td><td>${p.produto}</td>
                <td style="text-align:right;">${p.qtd}</td>
                <td style="text-align:right;">${formatPeso(p.totalKg)}</td>
                <td style="text-align:right;">${formatMoeda(p.totalValor)}</td>
                <td style="text-align:right;">${pct}</td>
            </tr>`;
        });

        let detalheSecao = '';
        if (registros && registros.length) {
            let linhasDet = '';
            registros.forEach(r => {
                const d = new Date(r.dataHora);
                linhasDet += `<tr>
                    <td>${gerarIdDisplay(r.id)}</td><td>${formatDate(d)}</td><td>${formatTime(d)}</td>
                    <td>${r.codigo}</td><td>${r.produto}</td>
                    <td style="text-align:right;">${formatPeso(r.pesoKg)}</td>
                    <td style="text-align:right;">${formatMoeda(r.valorKg)}</td>
                    <td style="text-align:right;">${formatMoeda(r.valorTotal)}</td>
                    <td>${(r.observacao || '').slice(0, 25)}</td>
                </tr>`;
            });
            detalheSecao = `
                <h2 style="font-size:0.95rem; margin:20px 0 8px; color:#101828;">Registros Detalhados</h2>
                <table><thead><tr>
                    <th>ID</th><th>Data</th><th>Hora</th><th>Código</th><th>Produto</th>
                    <th>Peso</th><th>Valor/kg</th><th>Total</th><th>Obs.</th>
                </tr></thead><tbody>${linhasDet}</tbody></table>
            `;
        }

        const printContent = document.getElementById('relatorioPrint');
        printContent.innerHTML = `
            <div style="max-width:900px; margin:0 auto; padding:20px; font-family:'Inter', system-ui, sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #101828; padding-bottom:10px; margin-bottom:4px;">
                    <h1 style="font-size:1.3rem; font-weight:800; letter-spacing:-0.3px;">REGISTRO DE QUEBRAS — PADARIA</h1>
                    <span style="font-size:0.78rem; color:#667085;">Relatório de auditoria</span>
                </div>
                <p style="color:#475569; margin-bottom:14px; font-size:0.88rem;">Período: ${periodo}</p>

                <div style="display:flex; gap:12px; margin-bottom:18px;">
                    <div style="flex:1; border:1px solid #ccc; border-radius:8px; padding:10px 14px;">
                        <div style="font-size:0.68rem; text-transform:uppercase; color:#667085; font-weight:700;">Registros</div>
                        <div style="font-size:1.2rem; font-weight:800; color:#101828;">${resumo.totalRegistros}</div>
                    </div>
                    <div style="flex:1; border:1px solid #ccc; border-radius:8px; padding:10px 14px;">
                        <div style="font-size:0.68rem; text-transform:uppercase; color:#667085; font-weight:700;">Total em Kg</div>
                        <div style="font-size:1.2rem; font-weight:800; color:#101828;">${formatPeso(resumo.totalPesoKg)}</div>
                    </div>
                    <div style="flex:1; border:1px solid #1a4972; border-radius:8px; padding:10px 14px; background:#e8f0f8;">
                        <div style="font-size:0.68rem; text-transform:uppercase; color:#0f3452; font-weight:700;">Total em R$</div>
                        <div style="font-size:1.2rem; font-weight:800; color:#0f3452;">${formatMoeda(resumo.totalValor)}</div>
                    </div>
                </div>

                <h2 style="font-size:0.95rem; margin-bottom:8px; color:#101828;">Total por Produto</h2>
                <table>
                    <thead><tr><th>Código</th><th>Produto</th><th>Registros</th><th>Total Kg</th><th>Total R$</th><th>% valor</th></tr></thead>
                    <tbody>${linhasBreak}</tbody>
                    <tfoot><tr style="font-weight:800; background:#f1f5f9;">
                        <td colspan="2">TOTAL GERAL</td>
                        <td style="text-align:right;">${resumo.totalRegistros}</td>
                        <td style="text-align:right;">${formatPeso(resumo.totalPesoKg)}</td>
                        <td style="text-align:right;">${formatMoeda(resumo.totalValor)}</td>
                        <td style="text-align:right;">100%</td>
                    </tr></tfoot>
                </table>

                ${detalheSecao}

                <p style="margin-top:18px; color:#667085; font-size:0.78rem;">Gerado em ${formatDateTime(new Date())}</p>
            </div>
        `;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(`
            <html><head><title>Relatório de Quebras</title>
            <style>
                body { font-family: system-ui, sans-serif; padding:20px; }
                table { width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:12px; }
                th { background:#f1f5f9; text-align:left; padding:8px 10px; border:1px solid #ccc; }
                td { padding:8px 10px; border:1px solid #ccc; }
                @media print { body { padding:0; } }
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
                    const filtrados = todos.filter(r => {
                        const d = new Date(r.dataHora);
                        return d >= inicio && d <= fim;
                    });
                    if (filtrados.length === 0) { alert('Nenhum registro no período.'); return; }
                    const periodoLabel = `${formatDate(inicio)} a ${formatDate(fim)}`;
                    exportarPDF(filtrados, periodoLabel);
                } catch (e) {
                    alert('Erro ao gerar PDF.');
                    console.error(e);
                }
            });

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