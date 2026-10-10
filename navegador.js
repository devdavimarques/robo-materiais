// Abre o Chrome com um perfil próprio da automação (pasta ./perfil-navegador),
// para que os logins do WordPress e do Google fiquem salvos entre execuções.
const path = require('path');
const { chromium } = require('playwright');

const PERFIL = path.join(__dirname, 'perfil-navegador');

async function abrirNavegador({ headless = false } = {}) {
  return chromium.launchPersistentContext(PERFIL, {
    channel: 'chrome',
    headless,
    viewport: null,
    acceptDownloads: true,
    // Sem isso o Google recusa o login ("este navegador pode não ser seguro").
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
  });
}

module.exports = { abrirNavegador };
