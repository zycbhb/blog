const change = document.querySelector('.scenery-switch');
const layer = document.querySelector('.scenery');
const status = document.querySelector('.scenery-status');
const portraitQuery = matchMedia('(orientation: portrait)');
let generation = 0;
let cooldown;
function read(key) { try { return sessionStorage.getItem(key); } catch {return null;} }
function save(key, value) { try {sessionStorage.setItem(key, value);} catch {} }
function message(value) {if (status) status.textContent = value;}
async function load(shuffle = false) {
  const id = ++generation;
  const endpoint = portraitQuery.matches ? 'pe.php' : 'pc.php';
  const key = 'scenery-' + endpoint;
  const seed = shuffle ? Date.now() : read(key) || Date.now();
  const img = new Image();
  img.alt = '';
  img.referrerPolicy = 'no-referrer';
  let timer;
  if (change) change.disabled = true;
  if (shuffle) message('正在换风景…');
  try {
    img.src = 'https://acg.neko-arc.top/' + endpoint + '?v=' + encodeURIComponent(seed);
    await Promise.race([img.decode(), new Promise((_,fail) => {timer=setTimeout(fail,16000);})]);
    if (id !== generation) return;
    const old = layer.querySelectorAll('img');
    layer.append(img);
    requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('visible')));
    setTimeout(() => old.forEach(el => el.remove()),700);
    save(key,String(seed));
    message('');
  } catch {
    if (id === generation && shuffle) message('图片暂时没加载出来，可以稍后再试。');
  } finally {
    clearTimeout(timer);
    if (change && id === generation) {
      clearTimeout(cooldown);
      cooldown = setTimeout(() => {change.disabled = false;},800);
    }
  }
}
change?.addEventListener('click', () => load(true));
portraitQuery.addEventListener('change', () => load());
load();
