(function() {
    'use strict';

    // ===== CONSTANTES =====
    const DB_NAME = 'QuebrasDB';
    const DB_VERSION = 2;
    const STORE_NAME = 'registros';

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
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('dataHora', 'dataHora', { unique: false });
                    store.createIndex('codigo', 'codigo', { unique: false });
                    store.createIndex('produto', 'produto', { unique: false });
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

    // ===== OPERAÇÕES INDEXEDDB =====
    function adicionarRegistro(registro) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.add(registro);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function obterTodosRegistros() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
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
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function atualizarRegistro(id, dados) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put({ ...dados, id });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function excluirRegistro(id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function limparTodosRegistros() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
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
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
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

    // ===== EXPORTAR CSV =====
    function exportarCSV(registros) {
        if (!registros || registros.length === 0) {
            alert('Nenhum registro para exportar.');
            return;
        }
        const headers = ['ID', 'Data', 'Hora', 'Código', 'Produto', 'Peso (kg)', 'Valor/kg', 'Valor total', 'Observação'];
        const rows = registros.map(r => {
            const d = new Date(r.dataHora);
            return [
                r.id,
                formatDate(d),
                formatTime(d),
                r.codigo,
                r.produto,
                r.pesoKg.toFixed(3).replace('.', ','),
                r.valorKg.toFixed(2).replace('.', ','),
                r.valorTotal.toFixed(2).replace('.', ','),
                (r.observacao || '').replace(/,/g, ';')
            ];
        });
        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.join(',') + '\n';
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_quebras_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ===== EXPORTAR PDF (usando jsPDF) =====
    function exportarPDF(registros, periodoLabel) {
        if (!registros || registros.length === 0) {
            alert('Nenhum registro para gerar PDF.');
            return;
        }

        // Usar a biblioteca jsPDF global
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

        // Cabeçalho da tabela
        const headers = ['ID', 'Data', 'Hora', 'Código', 'Produto', 'Peso', 'Valor/kg', 'Total'];
        const colWidths = [16, 22, 16, 20, 35, 22, 22, 22];
        let x = margin;

        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        doc.setFillColor(240, 244, 248);
        doc.rect(margin, y - 4, pageWidth - 2 * margin, 8, 'F');
        headers.forEach((h, i) => {
            doc.text(h, x + 1, y + 2);
            x += colWidths[i];
        });
        y += 8;

        // Linhas
        doc.setTextColor(0, 0, 0);
        let lineCount = 0;
        registros.forEach((r, idx) => {
            const d = new Date(r.dataHora);
            const row = [
                r.id,
                formatDate(d),
                formatTime(d),
                r.codigo,
                r.produto,
                formatPeso(r.pesoKg),
                formatMoeda(r.valorKg),
                formatMoeda(r.valorTotal)
            ];
            x = margin;
            row.forEach((cell, i) => {
                doc.text(String(cell), x + 1, y + 2);
                x += colWidths[i];
            });
            y += 7;
            lineCount++;
            // Quebra de página
            if (y > 190 && idx < registros.length - 1) {
                doc.addPage();
                y = margin + 10;
                // Reimprimir cabeçalho na nova página
                doc.setFillColor(240, 244, 248);
                doc.rect(margin, y - 4, pageWidth - 2 * margin, 8, 'F');
                x = margin;
                headers.forEach((h, i) => {
                    doc.text(h, x + 1, y + 2);
                    x += colWidths[i];
                });
                y += 8;
            }
        });

        // Rodapé
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Total: ${registros.length} registros`, margin, y + 6);
        doc.text(`Gerado em ${formatDateTime(new Date())}`, pageWidth - margin, y + 6, { align: 'right' });

        doc.save(`relatorio_quebras_${new Date().toISOString().slice(0,10)}.pdf`);
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
                return;
            }
            let html = `<div style="overflow-x:auto; max-height:500px; overflow-y:auto; border:1px solid var(--border-color); border-radius:var(--radius-sm);">
                <table class="relatorio-tabela">
                <thead><tr>
                    <th>ID</th><th>Data</th><th>Hora</th><th>Código</th><th>Produto</th>
                    <th>Peso</th><th>Valor/kg</th><th>Total</th><th>Obs.</th>
                </tr></thead><tbody>`;
            filtrados.forEach(r => {
                const d = new Date(r.dataHora);
                html += `<tr>
                    <td>${gerarIdDisplay(r.id)}</td>
                    <td>${formatDate(d)}</td>
                    <td>${formatTime(d)}</td>
                    <td>${r.codigo}</td>
                    <td>${r.produto}</td>
                    <td>${formatPeso(r.pesoKg)}</td>
                    <td>${formatMoeda(r.valorKg)}</td>
                    <td><strong>${formatMoeda(r.valorTotal)}</strong></td>
                    <td>${(r.observacao || '').slice(0, 20)}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
            html += `<p style="margin-top:12px; color:var(--text-secondary); font-size:0.9rem;">Total: ${filtrados.length} registros</p>`;
            container.innerHTML = html;
            window._relatorioData = filtrados;
            window._relatorioPeriodo = `${formatDate(inicio)} a ${formatDate(fim)}`;
        } catch (e) {
            alert('Erro ao gerar relatório.');
            console.error(e);
        }
    }

    // ===== IMPRIMIR RELATÓRIO =====
    function imprimirRelatorio() {
        const container = document.getElementById('relatorioResultado');
        const tabela = container.querySelector('table');
        if (!tabela) {
            alert('Gere o relatório primeiro.');
            return;
        }
        const printContent = document.getElementById('relatorioPrint');
        const periodo = document.getElementById('relDataInicial').value + ' a ' + document.getElementById('relDataFinal').value;
        printContent.innerHTML = `
            <div style="max-width:900px; margin:0 auto; padding:20px; font-family:'Inter', system-ui, sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #101828; padding-bottom:10px; margin-bottom:4px;">
                    <h1 style="font-size:1.3rem; font-weight:800; letter-spacing:-0.3px;">REGISTRO DE QUEBRAS — PADARIA</h1>
                    <span style="font-size:0.78rem; color:#667085;">Relatório de auditoria</span>
                </div>
                <p style="color:#475569; margin-bottom:18px; font-size:0.88rem;">Período: ${periodo}</p>
                ${tabela.outerHTML}
                <p style="margin-top:18px; color:#667085; font-size:0.78rem;">Gerado em ${formatDateTime(new Date())}</p>
            </div>
        `;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(`
            <html><head><title>Relatório de Quebras</title>
            <style>
                body { font-family: system-ui, sans-serif; padding:20px; }
                table { width:100%; border-collapse:collapse; font-size:0.85rem; }
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
        }
        if (pageId === 'relatorios') {
            const hoje = new Date();
            const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            document.getElementById('relDataInicial').value = inicio.toISOString().slice(0,10);
            document.getElementById('relDataFinal').value = hoje.toISOString().slice(0,10);
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
            await carregarListaRegistros();
            await atualizarContador();

            // Navegação
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const page = btn.dataset.page;
                    navegarPara(page);
                });
            });

            // Formulário de registro
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

            // Pesquisa e filtros
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

            // Detalhe - Editar e Excluir
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

            // Edição
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

            // Exclusão
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

            // Fechar modais
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

            // RELATÓRIOS
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

            // Botão Exportar PDF
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

            // CONFIGURAÇÕES
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

            // Inicializar relatórios com datas padrão
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