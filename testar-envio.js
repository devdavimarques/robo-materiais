// Teste de ponta a ponta com UM arquivo do Drive em UM produto.
// Uso: node testar-envio.js <id_produto> <id_arquivo_drive> "<nome no Drive>" [--executar]
// Sem --executar: só simula (não envia nem salva nada).
const fs = require('fs');
const path = require('path');
const { abrirNavegador } = require('./navegador');
const { baixarArquivoDrive } = require('./drive');
const { adicionarArquivos } = require('./wordpress');

const [idProduto, idArquivo, nomeDrive] = process.argv.slice(2);
const executar = process.argv.includes('--executar');

(async () => {
  if (!idProduto || !idArquivo || !nomeDrive) throw new Error('Uso: node testar-envio.js <id_produto> <id_arquivo_drive> "<nome>" [--executar]');
  const pasta = path.join(__dirname, 'downloads');
  fs.mkdirSync(pasta, { recursive: true });

  const navegador = await abrirNavegador();
  const aba = navegador.pages()[0];
  aba.on('dialog', (d) => d.accept()); // aviso de "sair sem salvar" na simulação

  const nome = nomeDrive.replace(/\.pdf$/i, '').trim();
  // O nome do arquivo local vira o nome do arquivo que o aluno baixa.
  const caminhoLocal = path.join(pasta, `${nome.replace(/[\\/:*?"<>|]/g, '-')}.pdf`);
  await baixarArquivoDrive(navegador, idArquivo, caminhoLocal);
  console.log(`Baixado do Drive: ${nomeDrive} (${fs.statSync(caminhoLocal).size} bytes)`);

  const resultado = await adicionarArquivos(aba, idProduto, [{ nome, caminhoLocal }], { executar });
  console.log(JSON.stringify(resultado, null, 2));
  await navegador.close();
})().catch((erro) => {
  console.error('ERRO:', erro.message);
  process.exit(1);
});
