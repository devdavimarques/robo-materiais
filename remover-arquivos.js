// Remove arquivos baixáveis de um produto pelo nome exato.
// Uso: node remover-arquivos.js <id_produto> "<nome 1>" "<nome 2>" ... [--executar]
// Sem --executar: só simula. Recusa deixar o produto vazio.
const { abrirNavegador } = require('./navegador');
const { removerArquivos } = require('./wordpress');

const args = process.argv.slice(2).filter((a) => a !== '--executar');
const [idProduto, ...nomes] = args;
const executar = process.argv.includes('--executar');

(async () => {
  if (!idProduto || !nomes.length) throw new Error('Uso: node remover-arquivos.js <id_produto> "<nome>" ... [--executar]');
  const navegador = await abrirNavegador();
  const aba = navegador.pages()[0];
  aba.on('dialog', (d) => d.accept());
  const resultado = await removerArquivos(aba, idProduto, nomes, { executar });
  console.log(JSON.stringify(resultado, null, 2));
  await navegador.close();
})().catch((erro) => {
  console.error('ERRO:', erro.message);
  process.exit(1);
});
