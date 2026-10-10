// Reconhecimento SOMENTE LEITURA: lista as pastas/arquivos do Drive e os arquivos
// baixáveis de um produto, salvando prints e um relatório em ./exploracao.
// Uso: node explorar.js [id_do_produto]
const fs = require('fs');
const path = require('path');
const { abrirNavegador } = require('./navegador');

const URL_DRIVE = 'https://drive.google.com/drive/folders/1u019eeaPre3pzm1AnNjs_RpnW9GvUqyv';
const ID_PRODUTO = process.argv[2] || '220360';
const SAIDA = path.join(__dirname, 'exploracao');

async function listarItensDrive(aba) {
  await aba.waitForSelector('div[data-id]', { timeout: 30000 });
  await aba.waitForTimeout(2000);
  return aba.$$eval('div[data-id]', (els) =>
    els.map((el) => ({
      id: el.getAttribute('data-id'),
      texto: (el.innerText || '').split('\n')[0].trim(),
      aria: el.getAttribute('aria-label'),
    })).filter((i) => i.texto)
  );
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const navegador = await abrirNavegador();
  const aba = navegador.pages()[0];
  const relatorio = {};

  // Drive: raiz → turnos → turmas (2 níveis).
  await aba.goto(URL_DRIVE);
  const turnos = await listarItensDrive(aba).catch(async (erro) => {
    await aba.screenshot({ path: path.join(SAIDA, 'drive-erro.png') }).catch(() => {});
    throw erro;
  });
  relatorio.drive = { raiz: turnos, turnos: {} };
  await aba.screenshot({ path: path.join(SAIDA, 'drive-raiz.png') }).catch(() => {});
  for (const turno of turnos) {
    await aba.goto(`https://drive.google.com/drive/folders/${turno.id}`);
    const turmas = await listarItensDrive(aba).catch(() => []);
    relatorio.drive.turnos[turno.texto] = {};
    for (const turma of turmas) {
      await aba.goto(`https://drive.google.com/drive/folders/${turma.id}`);
      relatorio.drive.turnos[turno.texto][turma.texto] = {
        id: turma.id,
        arquivos: await listarItensDrive(aba).catch(() => []),
      };
    }
  }

  // WordPress: arquivos baixáveis do produto.
  await aba.goto(`https://quadconcursos.com.br/wp-admin/post.php?post=${ID_PRODUTO}&action=edit`);
  await aba.waitForSelector('#title', { timeout: 30000 }).catch(async (erro) => {
    await aba.screenshot({ path: path.join(SAIDA, 'produto-erro.png') }).catch(() => {});
    fs.writeFileSync(path.join(SAIDA, 'relatorio.json'), JSON.stringify(relatorio, null, 2));
    throw erro;
  });
  relatorio.produto = {
    id: ID_PRODUTO,
    titulo: await aba.inputValue('#title'),
    arquivos: await aba.$$eval('.downloadable_files tbody tr', (linhas) =>
      linhas.map((l) => ({
        nome: l.querySelector('input[name="_wc_file_names[]"]')?.value,
        url: l.querySelector('input[name="_wc_file_urls[]"]')?.value,
      }))
    ),
    htmlTabela: await aba.$eval('.downloadable_files', (el) => el.outerHTML.slice(0, 4000)).catch(() => null),
  };
  await aba.locator('.downloadable_files').scrollIntoViewIfNeeded().catch(() => {});
  await aba.screenshot({ path: path.join(SAIDA, 'produto.png') }).catch(() => {});

  fs.writeFileSync(path.join(SAIDA, 'relatorio.json'), JSON.stringify(relatorio, null, 2));
  console.log('Relatório salvo em exploracao/relatorio.json');
  await navegador.close();
})().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
