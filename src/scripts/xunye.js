const room = document.querySelector('#xy-room');
const log = room.querySelector('.xy-log');
const choices = room.querySelector('.xy-choices');
const form = room.querySelector('form');
let indexRequest;
let current;
let busy = false;
const history = [];
const portrait = room.querySelector('[data-src]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const actor = portrait.parentElement;
let pose = 'idle';
let poseTimer;
let speechTimer;
function animate(name) {
  clearTimeout(poseTimer);
  clearTimeout(speechTimer);
  pose = name;
  actor.dataset.blink = 'false';
  actor.dataset.mouth = 'false';
  actor.dataset.pose = name;
  if (!room.open || document.hidden || reduced.matches || name !== 'idle') return;
  poseTimer = setTimeout(() => {
    actor.dataset.blink = 'true';
    poseTimer = setTimeout(() => animate('idle'), 115);
  }, 2900 + Math.random()*3800);
}
function syllable(chunk) {
  if (pose !== 'speak' || reduced.matches || !room.open) return;
  clearTimeout(speechTimer);
  const pause = /[，。！？、；：,.!?]$/.test(chunk);
  actor.dataset.mouth = String(!pause);
  speechTimer = setTimeout(() => {actor.dataset.mouth = 'false';}, 105);
}
function speaking(line) {
  animate('speak');
  const segments = line.match(/.{1,3}[，。！？、]?/gu) || [];
  let n = 0;
  function next() {
    if (!room.open || document.hidden || reduced.matches || n >= segments.length) return animate('idle');
    const part = segments[n++];
    syllable(part);
    poseTimer = setTimeout(next, /[，。！？、]/.test(part) ? 275 : 155);
  }
  next();
}
room.addEventListener('close', () => animate('idle'));
document.addEventListener('visibilitychange', () => animate(pose));
reduced.addEventListener('change', () => animate(pose));
function say(text, user = false) {
  const p = document.createElement('p');
  p.textContent = text;
  if (user) p.className = 'xy-user';
  log.append(p);
  log.scrollTop = log.scrollHeight;
  return p;
}
function links(posts) {
  for (const post of posts) {
    const a = document.createElement('a');
    a.href = post.url;
    a.addEventListener('click', () => {
      try {sessionStorage.setItem('xunye-bookmark', JSON.stringify({url:post.url, history:history.slice(-4), at:Date.now()}));} catch {}
    });
    a.textContent = post.title + ' ↗';
    log.append(a);
  }
  log.scrollTop = log.scrollHeight;
}
function index() {
  return indexRequest ||= fetch('/xunye-index.json').then(r => r.json()).catch(e => { indexRequest = null; throw e; });
}
document.querySelector('[data-visit]')?.addEventListener('click', () => document.querySelector('.xy-launch').click());
document.querySelector('.xy-launch').addEventListener('click', async () => {
  room.showModal();
  if (!portrait.src) portrait.src = portrait.dataset.src;
  for (const img of actor.querySelectorAll('[data-frame]')) {
    if (!img.src) img.src = '/assets/xunye-' + img.dataset.frame + '.webp';
  }
  animate(busy ? 'read' : 'idle');
  if (log.childElementCount) return;
  if (!reduced.matches) {
    const book = actor.querySelector('[data-frame=read]');
    book.decode().then(() => {
      if (!room.open || busy || pose !== 'idle') return;
      animate('read');
      poseTimer = setTimeout(() => animate('idle'), 760);
    }).catch(() => {});
  }
  const greeting = say('嗨，我叫寻页。刚读到一台从抽屉里翻出来的旧电脑，连屏幕都成了它的优点。你家里也留着这样的老伙计吗？');
  try {
    current = (await index()).find(p => p.url === location.pathname);
    if (current) {
      greeting.textContent = '咦，你也翻到《' + current.title + '》了。哪一段让你停下来了？';
      try {
        const saved = JSON.parse(sessionStorage.getItem('xunye-bookmark') || 'null');
        if (saved?.url === current.url && Date.now() - saved.at < 1800000) {
          history.push(...saved.history);
          greeting.textContent = current.url.includes('old-laptop') ? '就是这篇。你看到「自带屏幕和键盘」那一段了吗？平常觉得它占地方，网络出故障时，倒成了最顺手的东西。' : '刚才说的就是《' + current.title + '》。我们接着聊吧，你想先看哪一段？';
          sessionStorage.removeItem('xunye-bookmark');
        }
      } catch {}
      const button = choices.querySelector('[data-choice=start]');
      button.dataset.choice = 'current'; button.textContent = '陪我读这一篇';
    }
    history.push({role:'assistant',content:greeting.textContent});
  } catch { say('暂时没取到目录，可以从归档进入文章。'); }
});
room.querySelector('.xy-close').onclick = () => room.close();
choices.addEventListener('click', async e => {
  const action = e.target.dataset.choice;
  if (!action) return;
  try {
    const posts = await index();
    if (action === 'net') {
      const prompts = ['你会舍不得扔掉哪件旧东西？我大概会留下一本边角都卷起来的笔记。', '如果窗边这张桌子归你，除了电脑，你最想摆点什么？', '你翻博客的时候，是喜欢从头看，还是跟着感兴趣的链接一路点下去？'];
      const turn = Number(choices.dataset.turn || 0);
      const reply = prompts[turn % prompts.length];
      say(reply); history.push({role:'assistant', content:reply});
      speaking(reply);
      choices.dataset.turn = String(turn + 1);
      e.target.textContent = '换个话题';
      return;
    }
    if (action === 'current' && current) {
      form.querySelector('input').value = '陪我读这一篇。挑一个你觉得有意思的细节，聊聊它为什么有用。';
      form.requestSubmit(); return;
    }
    const note = say('我把书签夹在旧笔记本这篇了。机器躺了好几年，后来反倒靠自带的屏幕和键盘，省下了断网排查时的麻烦。');
    speaking(note.textContent);
    links(posts.filter(p => p.url.includes('old-laptop')));
    history.push({role:'assistant',content:'我们在聊旧笔记本改造家庭服务器的文章。'});
  } catch { say('目录暂时不可用，可以点「全部归档」。'); }
});
function findPosts(posts, query) {
  const tokens = query.toLowerCase().match(/[a-z0-9]+|[\u3400-\u9fff]{2,}/g) || [];
  const terms = new Set(tokens.flatMap(t => /^[a-z0-9]/.test(t) ? [t] : [...t].slice(1).map((_,i) => t.slice(i,i+2))));
  return posts.map(p => {
    const title = (p.title + p.tags.join(' ')).toLowerCase();
    const summary = p.summary.toLowerCase();
    let score = 0;
    for (const term of terms) score += title.includes(term) ? 4 : Number(summary.includes(term));
    return {p,score};
  }).filter(x => x.score).sort((a,b) => b.score-a.score).slice(0,2).map(x => x.p);
}
form.onsubmit = async e => {
  e.preventDefault();
  const input = form.querySelector('input');
  const q = input.value.trim();
  if (!q || busy) return;
  busy = true; form.querySelector('button').disabled = true;
  animate('read');
  say(q,true); input.value = '';
  const pending = say('正在翻阅日志…');
  let sources = [];
  try {
    sources = findPosts(await index(),q);
    if (current && !sources.includes(current)) sources.unshift(current);
    const response = await fetch('/api/xunye', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q, urls:sources.map(p => p.url),history:history.slice(-4)}), signal:AbortSignal.timeout(65000)});
    if (!response.ok) throw Error();
    const {answer} = await response.json();
    if (!answer) throw Error();
    animate('speak');
    if (reduced.matches || !room.open) pending.textContent = answer;
    else {
      const chars = Array.from(answer);
      const step = Math.max(3, Math.ceil(chars.length / 100));
      for (let i = step; i < chars.length && room.open && !document.hidden; i += step) {
        pending.textContent = chars.slice(0,i).join('');
        log.scrollTop = log.scrollHeight;
        const phrase = chars.slice(i-step,i).join('');
        syllable(phrase);
        await new Promise(resolve => setTimeout(resolve, /[。！？，]/.test(phrase) ? 220 : 145));
      }
      pending.textContent = answer;
    }
    history.push({role:'user',content:q},{role:'assistant',content:answer});
  } catch {
    pending.textContent = sources.length ? '对话服务暂时未接通，先给你相关日志的摘要。\n' + sources[0].summary : '对话服务暂时未接通，目录里也没找到匹配项。试试「Alpine」或「监控」。';
  } finally { animate('idle'); links(sources); busy = false; form.querySelector('button').disabled = false; }
};
