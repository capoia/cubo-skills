#!/usr/bin/env node
// Teste de fumaça dos scripts da skill. Roda no CI em Windows, macOS e Linux — é a única prova de
// que a skill funciona fora da máquina de quem escreveu. Sobe um Cubo de mentira na própria
// máquina, então não precisa de chave, de rede, nem de CRM no ar.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'cubo', 'skills', 'criar-landing-html', 'scripts')
const PASTA = mkdtempSync(join(tmpdir(), 'cubo-lp-fumaca-'))
const resultados = []

// Assíncrono de propósito: o Cubo de mentira roda neste mesmo processo, e um spawnSync congelaria o
// servidor enquanto o script filho espera a resposta dele.
function roda(script, args = [], ambiente = {}) {
  return new Promise((pronto) => {
    const filho = spawn(process.execPath, [join(SCRIPTS, script), ...args], { cwd: PASTA, env: { ...process.env, ...ambiente } })
    let saida = ''
    filho.stdout.on('data', (parte) => (saida += parte))
    filho.stderr.on('data', (parte) => (saida += parte))
    const limite = setTimeout(() => filho.kill(), 240_000)
    filho.on('close', (codigo) => {
      clearTimeout(limite)
      pronto({ codigo, saida })
    })
  })
}

async function caso(nome, funcao) {
  try {
    await funcao()
    resultados.push(`  ok     ${nome}`)
  } catch (erro) {
    resultados.push(`  FALHOU ${nome}\n         ${String(erro.message).replace(/\n/g, '\n         ')}`)
    process.exitCode = 1
  }
}

function confere(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem)
}

// Cubo de mentira: guarda o que recebeu para o teste conferir.
const recebidos = []
const landing = { id: 7, title: 'Teste', url: 'teste', status: 'active', builderVersion: 'html', publicUrl: 'https://x.test/teste', createdAt: '2026-01-01', html: `<main>${'<p>conteúdo longo da página</p>'.repeat(2500)}</main>`, head: '<style>.a{}</style>' }
const paginaDaMarca = `<!doctype html><html><head><title>Marca Teste</title><meta name="description" content="descrição"></head>
<body style="margin:0;background:#123456;font-family:Georgia">
<header><a href="/"><img src="/logo.png" alt="Logo da Marca Teste" width="120" height="40"></a></header>
<h1 style="color:#ffffff">Título da marca</h1><p style="color:#eeeeee">Um parágrafo com texto suficiente para contar como parágrafo.</p>
<a class="btn" style="background:#ff8800;color:#000;padding:10px;border-radius:999px;display:inline-block">Comprar agora</a>
<div class="cartao" style="width:300px;height:200px;background:#fff;border-radius:16px;margin:20px">cartão</div>
<nav><a href="/produtos/lavadora">Lavadoras</a> <a href="/contato">Fale</a></nav>
<section style="width:600px;height:400px;background-image:linear-gradient(#0000,#0000),url('/foto.png')"></section>
<style>.chega{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease}.chega.visto{opacity:1;transform:none}</style>
<div id="aviso-cookies" style="position:fixed;inset:auto 0 0 0;height:300px;background:#ff00ff;z-index:99">Usamos cookies para melhorar sua experiência</div>
<div style="height:900px"></div><div class="chega" style="width:400px;height:120px;background:#fff">chega ao rolar</div>
<script>new IntersectionObserver(function(e){e.forEach(function(i){if(i.isIntersecting)i.target.classList.add('visto')})}).observe(document.querySelector('.chega'))</script>
</body></html>`

let sharp
let png

const servidor = createServer((pedido, resposta) => {
  const partes = []
  pedido.on('data', (p) => partes.push(p))
  pedido.on('end', () => {
    const corpo = Buffer.concat(partes)
    recebidos.push({ metodo: pedido.method, url: pedido.url, cabecalhos: pedido.headers, corpo })
    const json = (codigo, dado) => {
      resposta.writeHead(codigo, { 'Content-Type': 'application/json' })
      resposta.end(JSON.stringify(dado))
    }
    if (pedido.url === '/marca') {
      resposta.writeHead(200, { 'Content-Type': 'text/html' })
      return resposta.end(paginaDaMarca)
    }
    if (pedido.url === '/logo.png' || pedido.url === '/foto.png') {
      resposta.writeHead(200, { 'Content-Type': 'image/png' })
      return resposta.end(png)
    }
    if (pedido.headers['x-api-key'] !== 'sk_teste') return json(401, { message: 'chave inválida' })
    if (pedido.url.startsWith('/api/landings/7') && pedido.method === 'GET') return json(200, { data: landing })
    if (pedido.url.startsWith('/api/landings/7') && pedido.method === 'PUT') return json(200, { data: { id: 7 } })
    if (pedido.url === '/api/landings/assets') return json(201, { data: { url: 'https://arquivos.test/a.webp' } })
    if (pedido.url.startsWith('/api/pipes')) return json(200, { data: [
      { id: 10, name: 'Vendas', stages: [{ id: 100 }], users: [{ id: 1, name: 'Ana' }] },
      { id: 11, name: 'Girbau', stages: [{ id: 110 }], users: [] },
    ], meta: { lastPage: 1 } })
    if (pedido.url === '/api/me/modules') return json(200, { data: ['landings'] })
    if (pedido.url.startsWith('/api/forms')) return json(403, { message: 'sem permissão' })
    return json(200, { data: [] })
  })
})
await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto))
const BASE = `http://127.0.0.1:${servidor.address().port}`
const acesso = { CUBO_BASE_URL: BASE, CUBO_API_KEY: 'sk_teste', PAGESPEED_API_KEY: 'chave-de-teste' }

await caso('requisitos: instala dependências, acha navegador, aprova com acesso configurado', async () => {
  const r = await roda('requisitos.mjs', [], acesso)
  confere(r.codigo === 0, `saiu com ${r.codigo}:\n${r.saida}`)
  confere(/\[ok\s*\] navegador/.test(r.saida), `sem navegador:\n${r.saida}`)
})

await caso('requisitos: sem acesso ao Cubo, aponta FALTA e sai com erro', async () => {
  const r = await roda('requisitos.mjs', [], { CUBO_BASE_URL: '', CUBO_API_KEY: '', CUBO_CONFIG: join(PASTA, 'nao-existe.env') })
  confere(r.codigo === 1 && /FALTA\] acesso ao Cubo/.test(r.saida), r.saida)
})

// O sharp só existe depois que o `requisitos` instalou as dependências.
sharp = createRequire(join(SCRIPTS, 'package.json'))('sharp')
// No Windows o cache do sharp mantém o arquivo aberto, e a faxina do fim não consegue apagar a pasta.
sharp.cache(false)
png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#7f9c90' } })
  .composite([{ input: Buffer.from('<svg width="3000" height="2000"><circle cx="1500" cy="1000" r="800" fill="#ea9e95"/></svg>') }])
  .png()
  .toBuffer()

await caso('imagem: foto de 3000px vira webp de 1600px dentro do alvo do topo', async () => {
  writeFileSync(join(PASTA, 'grande.png'), png)
  const r = await roda('imagem.mjs', ['grande.png', 'topo', 'topo.webp'])
  confere(r.codigo === 0, r.saida)
  const meta = await sharp(join(PASTA, 'topo.webp')).metadata()
  confere(meta.format === 'webp' && meta.width === 1600, `saiu ${meta.format} ${meta.width}px`)
  confere(readFileSync(join(PASTA, 'topo.webp')).length <= 200 * 1024, 'acima de 200 KB')
})

await caso('imagem: aceita endereço e apara a margem do logotipo', async () => {
  const r = await roda('imagem.mjs', [`${BASE}/logo.png`, 'logo', 'logo.webp'])
  confere(r.codigo === 0, r.saida)
  confere((await sharp(join(PASTA, 'logo.webp')).metadata()).width <= 480, 'logo acima de 480px')
})

await caso('cubo: manda chave e Accept, e o check aponta permissão faltando', async () => {
  const r = await roda('cubo.mjs', ['check'], acesso)
  confere(r.codigo === 0, r.saida)
  confere(/forms\s+FALTA PERMISSÃO/.test(r.saida) && /landings\s+ok/.test(r.saida), r.saida)
  const ultima = recebidos.at(-1)
  confere(ultima.cabecalhos.accept === 'application/json', 'sem Accept: application/json')
})

await caso('cubo: put com @arquivo manda o JSON do arquivo', async () => {
  writeFileSync(join(PASTA, 'corpo.json'), JSON.stringify({ title: 'Novo' }))
  const r = await roda('cubo.mjs', ['put', '/api/landings/7', '@corpo.json'], acesso)
  confere(r.codigo === 0, r.saida)
  const ultima = recebidos.at(-1)
  confere(ultima.metodo === 'PUT' && JSON.parse(ultima.corpo).title === 'Novo', 'corpo não chegou')
  confere(ultima.cabecalhos['content-type'] === 'application/json', 'sem Content-Type JSON')
})

await caso('cubo: upload vai como multipart com o arquivo', async () => {
  const r = await roda('cubo.mjs', ['upload', '/api/landings/assets', 'topo.webp'], acesso)
  confere(r.codigo === 0, r.saida)
  const ultima = recebidos.at(-1)
  confere(/multipart\/form-data/.test(ultima.cabecalhos['content-type']), 'não foi multipart')
  confere(ultima.corpo.includes('filename="topo.webp"'), 'arquivo não foi no campo file')
})

await caso('cubo: erro HTTP sai com código diferente de zero', async () => {
  const r = await roda('cubo.mjs', ['get', '/api/forms'], acesso)
  confere(r.codigo === 1 && /HTTP 403/.test(r.saida), r.saida)
})

await caso('cubo: destino aprova funil com etapa e usuário, e barra funil sem usuário ativo', async () => {
  const bom = await roda('cubo.mjs', ['destino', '10', '100'], acesso)
  confere(bom.codigo === 0 && /ok: o funil recebe leads/.test(bom.saida), bom.saida)
  const vazio = await roda('cubo.mjs', ['destino', '11'], acesso)
  confere(vazio.codigo === 1 && /PROBLEMA: o funil não tem nenhum usuário ativo/.test(vazio.saida), vazio.saida)
  const etapaErrada = await roda('cubo.mjs', ['destino', '10', '999'], acesso)
  confere(etapaErrada.codigo === 1 && /a etapa 999 não é deste funil/.test(etapaErrada.saida), etapaErrada.saida)
})

await caso('cubo: configurar grava o .cubo.env protegido e fora do git', async () => {
  mkdirSync(join(PASTA, 'projeto', '.git'), { recursive: true })
  const r = await roda('cubo.mjs', ['configurar', '--base=https://crm.teste/', '--chave=sk_segredo'], { CUBO_CONFIG: join(PASTA, 'projeto', '.cubo.env') })
  confere(r.codigo === 0, r.saida)
  const conteudo = readFileSync(join(PASTA, 'projeto', '.cubo.env'), 'utf8')
  confere(conteudo.includes('CUBO_BASE_URL=https://crm.teste\n') && conteudo.includes('CUBO_API_KEY=sk_segredo'), conteudo)
  confere(readFileSync(join(PASTA, 'projeto', '.gitignore'), 'utf8').includes('.cubo.env'), 'não foi para o .gitignore')
  confere(!r.saida.includes('sk_segredo'), 'imprimiu a chave inteira')
})

await caso('backup: guarda e restaura página maior que o limite de linha de comando do Windows', async () => {
  const guardado = await roda('backup.mjs', ['guardar', '7', 'bkp'], acesso)
  confere(guardado.codigo === 0, guardado.saida)
  const arquivo = readdirSync(join(PASTA, 'bkp')).find((nome) => nome.endsWith('.json'))
  confere(arquivo && existsSync(join(PASTA, 'bkp', arquivo.replace('.json', '.html'))), 'faltou o .html')
  const restaurado = await roda('backup.mjs', ['restaurar', join('bkp', arquivo)], acesso)
  confere(restaurado.codigo === 0, restaurado.saida)
  const enviado = JSON.parse(recebidos.at(-1).corpo)
  confere(enviado.html.length > 40_000, 'o html não foi inteiro')
  confere(!('id' in enviado) && !('publicUrl' in enviado) && !('createdAt' in enviado), 'mandou campo que o PUT recusa')
})

await caso('previa: captura, lista os rascunhos e acusa rolagem lateral', async () => {
  mkdirSync(join(PASTA, 'pagina'), { recursive: true })
  writeFileSync(join(PASTA, 'pagina', 'corpo.html'), '<main><h1>Oi</h1><p data-rascunho="texto do cliente">x</p><div class="largo" style="width:700px">largo</div></main>')
  const r = await roda('previa.mjs', [join('pagina', 'corpo.html'), '--capturar', '--porta=0'])
  confere(r.codigo === 0, r.saida)
  for (const nome of ['desktop-topo', 'desktop-pagina', 'celular-topo', 'celular-pagina']) {
    confere(existsSync(join(PASTA, 'previa', `${nome}.jpg`)), `faltou ${nome}.jpg`)
  }
  confere(/R1\s+texto do cliente/.test(r.saida), `rascunho não listado:\n${r.saida}`)
  confere(/\[celular\] a página rola para o lado/.test(r.saida), `não acusou a rolagem:\n${r.saida}`)
  confere(/borda em volta \(margem do body: 8px\)/.test(r.saida), `não acusou a borda do body:\n${r.saida}`)
})

await caso('previa: desenha o formulário do Cubo pela definição local e enxerga dentro do shadow DOM', async () => {
  writeFileSync(join(PASTA, 'pagina', 'form.html'), '<style>html,body{margin:0}</style><main><div class="lp-formulario"></div><p style="height:1500px"></p><div class="lp-formulario"></div></main>')
  writeFileSync(join(PASTA, 'pagina', 'formulario.json'), JSON.stringify({
    definition: { id: 'frm_previa', type: 'create', fields: [{ key: 'title', kind: 'text', label: 'Nome', required: true }] },
  }))
  const r = await roda('previa.mjs', [join('pagina', 'form.html'), `--formulario=${join('pagina', 'formulario.json')}`, '--capturar', '--porta=0'])
  confere(r.codigo === 0, r.saida)
  confere(!/nenhum campo de formulário/.test(r.saida), `formulário não apareceu (ou o detector não enxerga o shadow DOM):\n${r.saida}`)
  confere(/2 formulário\(s\)/.test(r.saida), `não contou os dois formulários:\n${r.saida}`)
})

await caso('previa: conta o que a página usa e cobra formulário no fim, ícone e chegada; galeria que rola de lado não é vazamento', async () => {
  const bloco = (i) => `<section><h2>Bloco ${i}</h2><p>${'Texto do bloco com argumento. '.repeat(12)}</p></section>`
  writeFileSync(join(PASTA, 'pagina', 'pobre.html'), `<style>html,body{margin:0} .g{display:grid;grid-auto-flow:column;grid-auto-columns:80%;overflow-x:auto}</style>
<main><section><h1>Topo</h1><div class="lp-formulario"></div><a href="#x" style="background:#333;color:#fff;padding:9px">Quero</a></section>
${[1, 2, 3, 4].map(bloco).join('')}<section><ul><li>um</li><li>dois</li><li>três</li></ul><div class="g"><figure>a</figure><figure>b</figure><figure>c</figure></div></section></main>`)
  const r = await roda('previa.mjs', [join('pagina', 'pobre.html'), '--capturar', '--porta=0'])
  confere(r.codigo === 0, r.saida)
  confere(/o que a página usa: 6 blocos · 1 formulário/.test(r.saida), `não contou:\n${r.saida}`)
  confere(/formulário só em um lugar/.test(r.saida), `não cobrou o formulário no fim:\n${r.saida}`)
  confere(/nenhum ícone na página/.test(r.saida), `não cobrou ícone:\n${r.saida}`)
  confere(/página parada/.test(r.saida), `não cobrou a chegada:\n${r.saida}`)
  confere(/blocos terminam sem botão/.test(r.saida), `não cobrou o botão por bloco:\n${r.saida}`)
  confere(/aviso\(s\) em aberto\. NÃO mostre/.test(r.saida), `não barrou a entrega:\n${r.saida}`)
  confere(!/rola para o lado/.test(r.saida), `acusou a galeria como vazamento:\n${r.saida}`)
})

await caso('previa: porta ocupada cai numa livre, e acusa recurso http:// que a página https bloquearia', async () => {
  writeFileSync(join(PASTA, 'pagina', 'http.html'), '<style>html,body{margin:0}</style><img src="http://exemplo.test/foto.webp" alt="x" width="10" height="10">')
  const ocupante = createServer().listen(8799, '127.0.0.1')
  await new Promise((pronto) => ocupante.once('listening', pronto).once('error', pronto))
  const r = await roda('previa.mjs', [join('pagina', 'http.html'), '--capturar'])
  ocupante.close()
  confere(r.codigo === 0, `não caiu numa porta livre:\n${r.saida}`)
  confere(/endereço http:\/\/ na página/.test(r.saida), `não acusou o http://:\n${r.saida}`)
})

await caso('previa: acusa título em linhas demais e colunas desproporcionais', async () => {
  writeFileSync(join(PASTA, 'pagina', 'feio.html'), `<style>html,body{margin:0} .g{display:grid;grid-template-columns:1fr 1fr;gap:20px} h1{font-size:60px;max-width:420px}</style>
<main><h1>Um título comprido demais que vai quebrar em muitas linhas na tela do computador</h1>
<div class="g"><div style="height:300px">pouco texto</div><div style="height:900px">formulário enorme</div></div>
<a href="#" style="background:#333;color:#fff;padding:10px">Quero</a></main>`)
  const r = await roda('previa.mjs', [join('pagina', 'feio.html'), '--capturar'])
  confere(r.codigo === 0, r.saida)
  confere(/\[desktop\] título em \d+ linhas/.test(r.saida), `não acusou o título:\n${r.saida}`)
  confere(/colunas desproporcionais/.test(r.saida), `não acusou as colunas:\n${r.saida}`)
})

await caso('video: comprime para mp4 sem áudio, corta e gera o pôster em webp', async () => {
  const ffmpeg = createRequire(join(SCRIPTS, 'package.json'))('ffmpeg-static')
  await new Promise((pronto, erro) => {
    const f = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '20', '-c:v', 'libx264', '-c:a', 'aac', join(PASTA, 'bruto.mp4')])
    f.on('close', (c) => (c === 0 ? pronto() : erro(new Error(`ffmpeg saiu com ${c}`))))
  })
  const r = await roda('video.mjs', ['bruto.mp4', 'fundo', '--saida=fundo'])
  confere(r.codigo === 0, r.saida)
  confere(existsSync(join(PASTA, 'fundo.mp4')) && existsSync(join(PASTA, 'fundo-poster.webp')), 'faltou o vídeo ou o pôster')
  confere(/sem áudio, 15s/.test(r.saida), `não cortou nem tirou o áudio:\n${r.saida}`)
  confere((await sharp(join(PASTA, 'fundo-poster.webp')).metadata()).format === 'webp', 'pôster não é webp')
})

await caso('previa: acusa conteúdo da primeira tela escondido por animação', async () => {
  writeFileSync(join(PASTA, 'pagina', 'escondido.html'), '<style>html,body{margin:0} h1{opacity:0}</style><main><h1>Oi</h1><a href="#" style="background:#333;color:#fff;padding:9px">Quero</a></main>')
  const r = await roda('previa.mjs', [join('pagina', 'escondido.html'), '--capturar', '--porta=0'])
  confere(r.codigo === 0, r.saida)
  confere(/primeira tela invisíveis ao abrir/.test(r.saida), `não acusou o topo escondido:\n${r.saida}`)
})

await caso('marca: mede cor, fonte, logotipo e foto de fundo com degradê por cima', async () => {
  const r = await roda('marca.mjs', [`${BASE}/marca`, '--pasta=raio-x'])
  confere(r.codigo === 0, r.saida)
  const pasta = join(PASTA, 'raio-x', readdirSync(join(PASTA, 'raio-x'))[0])
  const medidas = JSON.parse(readFileSync(join(pasta, 'marca.json'), 'utf8'))
  confere(medidas.fundos[0]?.valor === '#123456', `fundo: ${JSON.stringify(medidas.fundos)}`)
  confere(medidas.fontesTitulo.some((f) => f.valor.startsWith('Georgia')), `fonte: ${JSON.stringify(medidas.fontesTitulo)}`)
  confere(medidas.logotipos.some((l) => String(l.src).endsWith('/logo.png')), `logo: ${JSON.stringify(medidas.logotipos)}`)
  confere(medidas.imagens.some((i) => i.src.endsWith('/foto.png')), 'não achou a foto de fundo sob o degradê')
  confere(existsSync(join(pasta, 'celular-topo.jpg')), 'faltou a captura')
  confere(medidas.paginas.some((p) => p.url.endsWith('/produtos/lavadora')), `não listou a página de produtos: ${JSON.stringify(medidas.paginas)}`)
  confere(!medidas.paginas.some((p) => p.url.endsWith('/contato')), 'listou página sem matéria-prima')
  confere(medidas.sistema.raio.botao.some((r) => r.startsWith('999px')), `não mediu o botão em pílula: ${JSON.stringify(medidas.sistema.raio)}`)
  confere(medidas.sistema.raio.cartao.some((r) => r.startsWith('16px')), `não mediu o canto do cartão: ${JSON.stringify(medidas.sistema.raio)}`)
  confere(medidas.sistema.chegada.elementos >= 1 && /aparece e sobe 24px em 0.6s/.test(medidas.sistema.chegada.efeitos.join()), `não viu a chegada ao rolar: ${JSON.stringify(medidas.sistema.chegada)}`)
  confere(/o jeito do site/.test(r.saida), r.saida)
  confere(!medidas.fundos.some((f) => f.valor === '#ff00ff'), `o banner de cookies entrou na medida: ${JSON.stringify(medidas.fundos)}`)
})

await caso('previa: monta o lado a lado com o site e acusa a fonte do site que não carregou', async () => {
  writeFileSync(join(PASTA, 'pagina', 'fonte.html'), `<style>html,body{margin:0} @font-face{font-family:"Da Marca";src:url("${BASE}/nao-existe.woff2")} h1{font-family:"Da Marca",sans-serif}</style><main><h1>Oi</h1><a href="#" style="background:#333;color:#fff;padding:9px">Quero</a></main>`)
  const site = join(PASTA, 'raio-x', readdirSync(join(PASTA, 'raio-x'))[0])
  const r = await roda('previa.mjs', [join('pagina', 'fonte.html'), '--capturar', '--porta=0', `--site=${site}`])
  confere(r.codigo === 0, r.saida)
  confere(existsSync(join(PASTA, 'previa', 'lado-a-lado.jpg')), `não montou o lado a lado:\n${r.saida}`)
  confere(/fonte que não carregou.*Da Marca/.test(r.saida), `não acusou a fonte:\n${r.saida}`)
})

await caso('previa: compara com o site (canto, borda superior) e aceita lorem ipsum só dentro de rascunho', async () => {
  writeFileSync(join(PASTA, 'pagina', 'divergente.html'), `<style>html,body{margin:0} .c{width:320px;height:180px;background:#fff;border-top:4px solid #007481;border-radius:0}</style>
<main><section><h1>Oi</h1><a href="#" style="background:#333;color:#fff;padding:9px">Quero</a>
<div style="display:flex;gap:20px"><div class="c">um</div><div class="c">dois</div></div>
<p data-rascunho="depoimento real">Lorem ipsum dolor sit amet marcado</p><p>Lorem ipsum solto</p></section></main>`)
  const r = await roda('previa.mjs', [join('pagina', 'divergente.html'), '--capturar', '--porta=0', '--site=raio-x'])
  confere(r.codigo === 0, r.saida)
  confere(/comparada com o jeito do site/.test(r.saida), `não comparou:\n${r.saida}`)
  confere(/canto de cartão: o site usa 16px, a landing reto/.test(r.saida), `não acusou o canto:\n${r.saida}`)
  confere(/borda superior grossa em 2 cartão/.test(r.saida), `não acusou a borda superior:\n${r.saida}`)
  confere(/lorem ipsum fora de rascunho em 1 lugar/.test(r.saida), `lorem ipsum: devia acusar só o solto:\n${r.saida}`)
})

await caso('previa: formulário com canto diferente dos cartões e cidade em texto livre são acusados', async () => {
  writeFileSync(join(PASTA, 'pagina', 'form-destoa.html'), `<style>html,body{margin:0} .c{width:320px;height:180px;background:#fff;border-radius:16px}</style>
<main><section><h1>Oi</h1><div style="display:flex;gap:20px"><div class="c">um</div><div class="c">dois</div></div><div class="lp-formulario"></div></section></main>`)
  writeFileSync(join(PASTA, 'pagina', 'form-destoa.json'), JSON.stringify({
    definition: { id: 'frm_previa', type: 'create', fields: [
      { key: 'title', kind: 'text', label: 'Nome', required: true },
      { key: 'cf_local', kind: 'text', label: 'Cidade / UF' },
    ], settings: { theme: { radius: 0 } } },
  }))
  const r = await roda('previa.mjs', [join('pagina', 'form-destoa.html'), `--formulario=${join('pagina', 'form-destoa.json')}`, '--capturar', '--porta=0'])
  confere(r.codigo === 0, r.saida)
  confere(/formulário: campo com canto reto, os cartões pedem 12px/.test(r.saida), `não acusou o canto do campo:\n${r.saida}`)
  confere(/"Cidade \/ UF" em texto livre/.test(r.saida), `não acusou a cidade em texto:\n${r.saida}`)
})

await caso('previa: formulário mais alto que o minHeight reservado é acusado', async () => {
  writeFileSync(join(PASTA, 'pagina', 'alto.html'), '<style>html,body{margin:0}</style><main><h1>Oi</h1><div class="lp-formulario"></div></main>')
  writeFileSync(join(PASTA, 'pagina', 'alto.json'), JSON.stringify({
    definition: { id: 'frm_previa', type: 'create', fields: Array.from({ length: 9 }, (_, i) => ({ key: `cf_${i + 1}`, kind: 'text', label: `Campo ${i + 1}` })) },
  }))
  const r = await roda('previa.mjs', [join('pagina', 'alto.html'), `--formulario=${join('pagina', 'alto.json')}`, '--capturar', '--porta=0'])
  confere(r.codigo === 0, r.saida)
  confere(/o formulário tem \d+px e o trecho reserva 420 — use minHeight/.test(r.saida), `não mandou reservar a altura do formulário:\n${r.saida}`)
})

await caso('entrega: junta prévia, PageSpeed e teste final num checklist em Markdown', async () => {
  mkdirSync(join(PASTA, 'entrega', 'previa'), { recursive: true })
  writeFileSync(join(PASTA, 'entrega', 'previa', 'resultado.json'), JSON.stringify({ telas: ['computador 1366px', 'celular 390px'], avisos: [], rolagemLateral: false, rascunhos: [] }))
  writeFileSync(join(PASTA, 'entrega', 'pagespeed-mobile.json'), JSON.stringify({ notas: { Desempenho: 94, Acessibilidade: 100 } }))
  writeFileSync(join(PASTA, 'entrega', 'teste-final.json'), JSON.stringify({ ok: true, negociacao: { id: 80, link: 'https://crm.teste/deals/80/edit', funil: 'Vendas', etapa: 'Novo', responsavel: 'Ana' }, campos: [{ nome: 'Nome', ok: true }], utms: { gravadas: 3, enviadas: 5 }, pixel: 'disparado' }))
  const r = await roda('entrega.mjs', [`${BASE}/marca`, `--pasta=${join(PASTA, 'entrega')}`, '--titulo=Teste'])
  confere(r.codigo === 0, r.saida)
  confere(/\| ✅ \| Página no ar \| respondeu 200/.test(r.saida), `não conferiu a página no ar:\n${r.saida}`)
  confere(/\| ✅ \| PageSpeed no celular \| Desempenho \*\*94\*\*/.test(r.saida), `sem a nota do celular:\n${r.saida}`)
  confere(/\| ➖ \| PageSpeed no computador \| não medido/.test(r.saida), `devia dizer que o computador não foi medido:\n${r.saida}`)
  confere(/\[negociação #80\]\(https:\/\/crm\.teste\/deals\/80\/edit\)/.test(r.saida), `sem o link do lead:\n${r.saida}`)
  confere(/\| ⚠️ \| UTMs \| só 3 de 5/.test(r.saida), `não acusou UTM incompleta:\n${r.saida}`)
})

await caso('icone: procura pelo nome e entrega o <svg> no padrão da página', async () => {
  const busca = await roda('icone.mjs', ['buscar', 'timer'])
  confere(busca.codigo === 0 && /timer:.*\btimer\b/.test(busca.saida), busca.saida)
  const r = await roda('icone.mjs', ['timer', 'nao-existe-mesmo'])
  confere(r.codigo === 0, r.saida)
  confere(/<svg class="lp-icone"[^>]*stroke="currentColor"[^>]*aria-hidden="true">.*<circle/.test(r.saida), `svg fora do padrão:\n${r.saida}`)
  confere(/nao-existe-mesmo: não existe/.test(r.saida), `não avisou do ícone inexistente:\n${r.saida}`)
})

servidor.close()
console.log(`fumaça em ${process.platform} (Node ${process.versions.node})\n${resultados.join('\n')}`)
if (!process.exitCode) {
  try {
    rmSync(PASTA, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  } catch (erro) {
    console.log(`(não consegui apagar ${PASTA}: ${erro.code} — não afeta o resultado)`)
  }
}
