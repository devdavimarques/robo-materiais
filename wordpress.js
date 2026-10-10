// Adiciona arquivos baixáveis a um produto do WooCommerce pela tela de edição,
// do mesmo jeito que o operador: "Adicionar arquivo" → "Escolher arquivo" → "Atualizar".
//
// Regra de ouro: o robô SÓ ACRESCENTA. As linhas existentes nunca são alteradas
// (cada uma mantém seu hash, preservando as permissões dos alunos) e o produto
// nunca é salvo vazio. Qualquer divergência → sai sem salvar.

const URL_EDITAR = (id) => `https://quadconcursos.com.br/wp-admin/post.php?post=${id}&action=edit`;

async function lerArquivos(aba) {
  return aba.$$eval('.downloadable_files tbody tr', (linhas) =>
    linhas.map((l) => ({
      nome: l.querySelector('input[name="_wc_file_names[]"]')?.value || '',
      url: l.querySelector('input[name="_wc_file_urls[]"]')?.value || '',
      hash: l.querySelector('input[name="_wc_file_hashes[]"]')?.value || '',
    }))
  );
}

// O WordPress junta espaços repetidos ao salvar o nome; comparamos sempre normalizado.
const normalizar = (nome) => nome.replace(/\s+/g, ' ').trim();

function mesmaLinha(a, b) {
  return a.nome === b.nome && a.url === b.url && a.hash === b.hash;
}

// Erros de JavaScript da página, para diagnosticar travamentos no "Atualizar".
const errosDaPagina = [];
function registrarErros(aba) {
  if (aba._registrandoErros) return;
  aba._registrandoErros = true;
  aba.on('pageerror', (e) => errosDaPagina.push(`pageerror: ${e.message}`));
  aba.on('console', (m) => { if (m.type() === 'error') errosDaPagina.push(`console: ${m.text().slice(0, 300)}`); });
}

async function abrirProduto(aba, idProduto) {
  registrarErros(aba);
  await aba.goto(URL_EDITAR(idProduto));
  await aba.waitForSelector('#title', { timeout: 30000 });
  // Só mexe na tela depois que todos os scripts (editor, Rank Math, IA...) carregaram.
  await aba.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await aba.waitForFunction(() => !!window.wp && !!window.jQuery && document.readyState === 'complete', null, { timeout: 30000 });
  if (!(await aba.isChecked('#_downloadable'))) {
    throw new Error(`Produto ${idProduto} não está marcado como "Baixável".`);
  }
  await aba.locator('.downloadable_files').scrollIntoViewIfNeeded();
  return { titulo: await aba.inputValue('#title'), arquivos: await lerArquivos(aba) };
}

// Clica em "Atualizar" e espera o redirecionamento (post.php?...&message=N).
// Se o envio travar (ícone girando sem sair do lugar), clica de novo — como o operador faria.
// Se ainda assim não salvar, guarda print, avisos e erros de JS em ./exploracao.
async function salvarProduto(aba, idProduto, { tentativas = 3, esperaPorTentativa = 45000 } = {}) {
  const salvou = aba.waitForURL(/[?&]message=\d+/, { timeout: tentativas * esperaPorTentativa + 120000 }).then(() => true);
  salvou.catch(() => {});
  const inicio = Date.now();
  try {
    for (let i = 1; i <= tentativas; i++) {
      if (i > 1) console.log(`  (envio travado, clicando em "Atualizar" de novo — tentativa ${i})`);
      await aba.click('#publish', { force: i > 1 });
      const ok = await Promise.race([salvou, aba.waitForTimeout(esperaPorTentativa).then(() => false)]);
      if (ok) break;
      if (i === tentativas) await salvou; // última chance: espera o restante do prazo
    }
    console.log(`  (salvou em ${Math.round((Date.now() - inicio) / 1000)}s)`);
    if (errosDaPagina.length) {
      require('fs').writeFileSync(require('path').join(__dirname, 'exploracao', `erros-js-${idProduto}.txt`), errosDaPagina.join('\n'));
    }
  } catch (erro) {
    const path = require('path');
    await aba.screenshot({ path: path.join(__dirname, 'exploracao', `falha-salvar-${idProduto}.png`), fullPage: false }).catch(() => {});
    const avisos = await aba.$$eval('.notice:not(.hidden), .error:not(.hidden), #publish', (els) =>
      els.map((e) => `${e.id || e.className}: ${(e.innerText || e.value || '').trim().slice(0, 200)} ${e.disabled ? '[desabilitado]' : ''}`)
    ).catch(() => []);
    const fs = require('fs');
    fs.writeFileSync(path.join(__dirname, 'exploracao', `falha-salvar-${idProduto}.txt`), errosDaPagina.join('\n'));
    throw new Error(`O produto ${idProduto} não salvou. Avisos na tela: ${avisos.join(' | ') || 'nenhum'}. Erros de JS: ${errosDaPagina.length} (ver exploracao/falha-salvar-${idProduto}.txt)`);
  }
}

// Envia um PDF pela janela de mídia do WooCommerce (vai para woocommerce_uploads)
// e devolve a URL que ela preencheu na linha.
async function enviarPelaJanelaDeMidia(aba, linha, caminhoLocal) {
  await linha.locator('.upload_file_button').click();
  const modal = aba.locator('.media-modal:visible');
  await modal.waitFor({ timeout: 15000 });
  const abaEnviar = modal.locator('.media-router .media-menu-item', { hasText: /Enviar arquivos/i });
  if (await abaEnviar.count()) await abaEnviar.first().click();

  const [seletor] = await Promise.all([
    aba.waitForEvent('filechooser', { timeout: 15000 }),
    modal.locator('.upload-ui .browser').first().click(),
  ]);
  await seletor.setFiles(caminhoLocal);

  // Espera o upload terminar e o arquivo novo ficar como único selecionado.
  await modal.locator('.attachments .attachment.uploading').first()
    .waitFor({ state: 'detached', timeout: 180000 }).catch(() => {});
  await aba.waitForFunction(
    () => document.querySelectorAll('.media-modal .attachments .attachment.selected:not(.uploading)').length >= 1,
    null,
    { timeout: 180000 }
  );
  const selecionados = await modal.locator('.attachments .attachment.selected').count();
  if (selecionados !== 1) throw new Error(`Janela de mídia com ${selecionados} itens selecionados (esperado 1).`);

  const botaoInserir = modal.locator('.media-button-select');
  await botaoInserir.waitFor({ state: 'visible' });
  await aba.waitForFunction(() => !document.querySelector('.media-modal .media-button-select')?.disabled);
  await botaoInserir.click();
  await modal.waitFor({ state: 'hidden', timeout: 15000 });

  const url = await linha.locator('input[name="_wc_file_urls[]"]').inputValue();
  if (!url.includes('/woocommerce_uploads/')) {
    throw new Error(`URL inesperada após o envio (fora da pasta protegida): ${url || '(vazia)'}`);
  }
  return url;
}

// novos: [{ nome, caminhoLocal }]. executar=false → simula: cria as linhas, não envia nem salva.
async function adicionarArquivos(aba, idProduto, novos, { executar = false, log = console.log } = {}) {
  const antes = await abrirProduto(aba, idProduto);
  log(`Produto ${idProduto}: "${antes.titulo}" — ${antes.arquivos.length} arquivo(s) atuais.`);

  for (const n of novos) n.nome = normalizar(n.nome);
  const nomesAtuais = new Set(antes.arquivos.map((a) => normalizar(a.nome)));
  const pendentes = novos.filter((n) => !nomesAtuais.has(n.nome));
  for (const n of novos) if (nomesAtuais.has(n.nome)) log(`  = já existe, pulando: ${n.nome}`);
  if (!pendentes.length) return { adicionados: [], total: antes.arquivos.length };

  for (const novo of pendentes) {
    await aba.locator('.downloadable_files a.insert').click();
    const linha = aba.locator('.downloadable_files tbody tr').last();
    await linha.locator('input[name="_wc_file_names[]"]').fill(novo.nome);
    if (executar) {
      novo.url = await enviarPelaJanelaDeMidia(aba, linha, novo.caminhoLocal);
      log(`  + enviado: ${novo.nome}`);
    } else {
      log(`  + [simulação] adicionaria: ${novo.nome}`);
    }
  }

  // Conferência antes de salvar: antigas intactas, na mesma ordem, + exatamente as novas.
  const proposta = await lerArquivos(aba);
  const esperado = antes.arquivos.length + pendentes.length;
  const antigasIntactas = antes.arquivos.every((a, i) => proposta[i] && mesmaLinha(a, proposta[i]));
  if (proposta.length !== esperado || !antigasIntactas || proposta.length === 0) {
    throw new Error(`Conferência falhou antes de salvar (atual ${proposta.length}, esperado ${esperado}, antigas intactas: ${antigasIntactas}). Nada foi salvo.`);
  }

  if (!executar) {
    log(`  [simulação] ficaria com ${esperado} arquivo(s). Saindo sem salvar.`);
    return { adicionados: [], total: antes.arquivos.length, simulado: pendentes.map((p) => p.nome) };
  }

  await salvarProduto(aba, idProduto);

  // Conferência depois de salvar, com a página recarregada.
  const depois = await abrirProduto(aba, idProduto);
  const antigasOk = antes.arquivos.every((a) => depois.arquivos.some((d) => mesmaLinha(a, d)));
  const novasOk = pendentes.every((p) => depois.arquivos.some((d) => normalizar(d.nome) === p.nome && d.url === p.url && d.hash));
  if (!antigasOk || !novasOk || depois.arquivos.length !== esperado) {
    throw new Error(`Conferência após salvar falhou (antigas ok: ${antigasOk}, novas ok: ${novasOk}, total ${depois.arquivos.length}/${esperado}). VERIFICAR O PRODUTO ${idProduto} MANUALMENTE.`);
  }
  log(`  ✔ salvo e conferido: ${depois.arquivos.length} arquivo(s) no produto.`);
  return { adicionados: pendentes.map((p) => p.nome), total: depois.arquivos.length };
}

// Remove arquivos pelo nome exato. Nunca deixa o produto vazio: se a remoção
// zeraria a lista, nada é salvo (adicione os novos ANTES de remover os antigos).
async function removerArquivos(aba, idProduto, nomes, { executar = false, log = console.log } = {}) {
  const antes = await abrirProduto(aba, idProduto);
  log(`Produto ${idProduto}: "${antes.titulo}" — ${antes.arquivos.length} arquivo(s) atuais.`);

  const alvo = new Set(nomes.map(normalizar));
  const ficam = antes.arquivos.filter((a) => !alvo.has(normalizar(a.nome)));
  const saem = antes.arquivos.filter((a) => alvo.has(normalizar(a.nome)));
  const naoEncontrados = [...alvo].filter((n) => !saem.some((s) => normalizar(s.nome) === n));
  if (naoEncontrados.length) throw new Error(`Não encontrados no produto: ${naoEncontrados.join(' | ')}. Nada foi salvo.`);
  if (ficam.length === 0) throw new Error('A remoção deixaria o produto SEM arquivos (alunos perderiam o acesso). Nada foi salvo.');

  const linhas = aba.locator('.downloadable_files tbody tr');
  for (const arquivo of saem) {
    const linha = linhas.filter({ has: aba.locator(`input[name="_wc_file_hashes[]"][value="${arquivo.hash}"]`) });
    if ((await linha.count()) !== 1) throw new Error(`Linha ambígua para "${arquivo.nome}". Nada foi salvo.`);
    await linha.locator('a.delete').click();
    log(`  - ${executar ? 'removido' : '[simulação] removeria'}: ${arquivo.nome}`);
  }

  const proposta = await lerArquivos(aba);
  const intactas = ficam.every((f, i) => proposta[i] && mesmaLinha(f, proposta[i]));
  if (proposta.length !== ficam.length || !intactas) {
    throw new Error(`Conferência falhou antes de salvar (ficariam ${proposta.length}, esperado ${ficam.length}). Nada foi salvo.`);
  }
  if (!executar) {
    log(`  [simulação] ficaria com ${ficam.length} arquivo(s). Saindo sem salvar.`);
    return { removidos: [], total: antes.arquivos.length };
  }

  await salvarProduto(aba, idProduto);
  const depois = await abrirProduto(aba, idProduto);
  const ok = depois.arquivos.length === ficam.length && ficam.every((f) => depois.arquivos.some((d) => mesmaLinha(f, d)));
  if (!ok) throw new Error(`Conferência após salvar falhou. VERIFICAR O PRODUTO ${idProduto} MANUALMENTE.`);
  log(`  ✔ salvo e conferido: ${depois.arquivos.length} arquivo(s) no produto.`);
  return { removidos: saem.map((s) => s.nome), total: depois.arquivos.length };
}

module.exports = { adicionarArquivos, removerArquivos, abrirProduto };
