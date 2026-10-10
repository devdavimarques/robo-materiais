// Acesso ao Google Drive usando a sessão logada do navegador da automação.
const fs = require('fs');

// Baixa um arquivo do Drive pelo ID e salva em `destino`. Garante que é um PDF de verdade.
async function baixarArquivoDrive(navegador, idArquivo, destino) {
  const resposta = await navegador.request.get(
    `https://drive.google.com/uc?export=download&id=${idArquivo}`
  );
  const corpo = await resposta.body();
  if (!resposta.ok() || corpo.subarray(0, 4).toString() !== '%PDF') {
    throw new Error(
      `Drive não devolveu um PDF para ${idArquivo} (status ${resposta.status()}, tipo ${resposta.headers()['content-type']})`
    );
  }
  fs.writeFileSync(destino, corpo);
  return destino;
}

module.exports = { baixarArquivoDrive };
