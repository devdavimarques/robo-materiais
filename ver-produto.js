// Mostra (somente leitura) os arquivos baixáveis de um produto e salva um print.
// Uso: node ver-produto.js <id_produto>
const path = require('path');
const { abrirNavegador } = require('./navegador');
const { abrirProduto } = require('./wordpress');

(async () => {
  const navegador = await abrirNavegador({ headless: true });
  const aba = navegador.pages()[0] || (await navegador.newPage());
  const produto = await abrirProduto(aba, process.argv[2]);
  const avisos = await aba.$$eval('.wrap .notice, .wrap #message', (els) => els.map((e) => `${e.id} ${e.className} :: ${e.innerText.trim()}`));
  console.log(JSON.stringify({ ...produto, avisos }, null, 2));
  await aba.screenshot({ path: path.join(__dirname, 'exploracao', `produto-${process.argv[2]}.png`) }).catch(() => {});
  await navegador.close();
})().catch((erro) => {
  console.error('ERRO:', erro.message);
  process.exit(1);
});
