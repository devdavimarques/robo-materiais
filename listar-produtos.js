// Lista (somente leitura) os produtos mais recentes: ID, título e status.
// Uso: node listar-produtos.js [busca]
const { abrirNavegador } = require('./navegador');

const BUSCA = process.argv[2] || '';

(async () => {
  const navegador = await abrirNavegador({ headless: true });
  const aba = navegador.pages()[0] || (await navegador.newPage());
  const url = new URL('https://quadconcursos.com.br/wp-admin/edit.php');
  url.search = new URLSearchParams({ post_type: 'product', orderby: 'date', order: 'desc', s: BUSCA }).toString();
  await aba.goto(url.toString());
  await aba.waitForSelector('#the-list', { timeout: 30000 });
  const produtos = await aba.$$eval('#the-list tr[id^="post-"]', (linhas) =>
    linhas.slice(0, 15).map((l) => ({
      id: l.id.replace('post-', ''),
      titulo: l.querySelector('.row-title')?.innerText.trim(),
      status: (l.querySelector('.post-state')?.innerText || 'Publicado').trim(),
    }))
  );
  console.table(produtos);
  await navegador.close();
})().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
