// Passo único: abre o WordPress e o Drive para você fazer login manualmente.
// Feche o navegador quando terminar — a sessão fica salva no perfil da automação.
// Uso: node login.js [url_de_login_do_wordpress]  (o /wp-admin do site é oculto para deslogados)
const { abrirNavegador } = require('./navegador');

const URL_WP = process.argv[2] || 'https://quadconcursos.com.br/wp-admin/';
const URL_DRIVE = 'https://drive.google.com/drive/folders/1u019eeaPre3pzm1AnNjs_RpnW9GvUqyv';

(async () => {
  const navegador = await abrirNavegador();
  const [aba] = navegador.pages();
  await aba.goto(URL_WP);
  const abaDrive = await navegador.newPage();
  await abaDrive.goto(URL_DRIVE);
  console.log('Faça login no WordPress e no Google. Feche o navegador quando terminar.');
  await new Promise((resolve) => navegador.on('close', resolve));
  console.log('Sessão salva.');
})();
