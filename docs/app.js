const API='https://gamerecarga-mz.valterpedrojorge01.workers.dev';
const games=[
  {name:'Call of Duty Mobile',mark:'COD',image:'assets/cod-mobile.svg',packs:[['80 CP',80],['420 CP',390],['880 CP',760],['2400 CP',1890]]},
  {name:'Free Fire',mark:'FF',image:'assets/free-fire.svg',packs:[['100 Diamantes',85],['310 Diamantes',245],['520 Diamantes',395],['1060 Diamantes',790]]},
  {name:'Mobile Legends',mark:'ML',image:'assets/mobile-legends.svg',packs:[['86 Diamonds',75],['172 Diamonds',145],['257 Diamonds',210],['706 Diamonds',520]]},
  {name:'PUBG Mobile',mark:'PUBG',image:'assets/pubg-mobile.svg',packs:[['60 UC',75],['325 UC',365],['660 UC',690],['1800 UC',1790]]},
  {name:'Roblox',mark:'RBX',image:'assets/roblox.svg',packs:[['80 Robux',85],['400 Robux',390],['800 Robux',720],['1700 Robux',1450]]},
  {name:'EA FC Mobile',mark:'FC',image:'assets/ea-fc-mobile.svg',packs:[['100 FC Points',95],['520 FC Points',450],['1050 FC Points',850],['2200 FC Points',1690]]}
];
const params=new URLSearchParams(location.search);
if(params.get('teste')==='10') games.unshift({name:'TESTE DE PAGAMENTO',mark:'TEST',image:'assets/free-fire.svg',packs:[['Cobrança de teste',10]]});
const money=n=>new Intl.NumberFormat('pt-MZ').format(n)+' MT';
const grid=document.querySelector('#grid');
function render(list){grid.innerHTML=list.map(g=>`<article class="game"><div class="game-cover"><img src="${g.image}" alt="${g.name}" loading="lazy"><span>${g.mark}</span></div><div class="game-body"><h3>${g.name}</h3><p>Pacotes disponíveis</p><div class="packs">${g.packs.map(p=>`<button class="pack" title="${g.name} — ${p[0]}" onclick="openCheckout('${g.name.replace(/'/g,"\\'")}','${p[0].replace(/'/g,"\\'")}',${p[1]})">${p[0]}<b>${money(p[1])}</b></button>`).join('')}</div><button class="buy" onclick="openCheckout('${g.name.replace(/'/g,"\\'")}','${g.packs[0][0].replace(/'/g,"\\'")}',${g.packs[0][1]})">Comprar agora</button></div></article>`).join('')}
function ensureModal(){
  if(document.querySelector('#checkoutModal')) return;
  const style=document.createElement('style');
  style.textContent=`#checkoutModal{position:fixed;inset:0;background:rgba(5,8,20,.82);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;z-index:9999;padding:20px}#checkoutModal.open{display:flex}.checkout-box{width:min(520px,100%);background:#0d1428;border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:26px;box-shadow:0 24px 80px rgba(0,0,0,.45);color:#fff}.checkout-box h2{margin:0 0 8px}.checkout-box .sub{margin:0 0 20px;opacity:.75}.checkout-grid{display:grid;gap:12px}.checkout-grid label{font-size:13px;opacity:.9}.checkout-grid input,.checkout-grid select{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#111a31;color:#fff}.checkout-actions{display:flex;gap:10px;margin-top:18px}.checkout-actions button{flex:1;padding:13px;border:0;border-radius:12px;font-weight:700;cursor:pointer}.checkout-cancel{background:#26304a;color:#fff}.checkout-submit{background:linear-gradient(135deg,#6d5dfc,#3f8cff);color:#fff}.checkout-msg{margin-top:14px;padding:12px;border-radius:10px;background:rgba(255,255,255,.06);display:none;white-space:pre-wrap;font-size:13px}.checkout-close{float:right;background:none;border:0;color:#fff;font-size:24px;cursor:pointer}`;
  document.head.appendChild(style);
  const modal=document.createElement('div');
  modal.id='checkoutModal';
  modal.innerHTML=`<div class="checkout-box"><button class="checkout-close" id="checkoutClose">×</button><h2>Finalizar recarga</h2><p class="sub" id="checkoutProduct"></p><form id="checkoutForm" class="checkout-grid"><input type="hidden" id="checkoutAmount"><input type="hidden" id="checkoutGame"><input type="hidden" id="checkoutPack"><label>ID do jogador<input id="playerId" required placeholder="Ex.: 123456789"></label><label>Número para pagamento<input id="paymentNumber" required inputmode="tel" placeholder="84/85/86/87..." autocomplete="tel"></label><label>Método de pagamento<select id="paymentMethod" required><option value="mpesa">M-Pesa</option><option value="mkesh">mKesh</option></select></label><div class="checkout-actions"><button type="button" class="checkout-cancel" id="checkoutCancel">Cancelar</button><button type="submit" class="checkout-submit">Continuar pagamento</button></div></form><div class="checkout-msg" id="checkoutMsg"></div></div>`;
  document.body.appendChild(modal);
  document.querySelector('#checkoutClose').onclick=closeCheckout;
  document.querySelector('#checkoutCancel').onclick=closeCheckout;
  modal.addEventListener('click',e=>{if(e.target===modal)closeCheckout()});
  document.querySelector('#checkoutForm').addEventListener('submit',submitCheckout);
}
function openCheckout(game,pack,amount){ensureModal();document.querySelector('#checkoutGame').value=game;document.querySelector('#checkoutPack').value=pack;document.querySelector('#checkoutAmount').value=amount;document.querySelector('#checkoutProduct').textContent=`${game} — ${pack} — ${money(amount)}`;document.querySelector('#checkoutMsg').style.display='none';document.querySelector('#checkoutForm').style.display='grid';document.querySelector('#checkoutModal').classList.add('open');document.querySelector('#playerId').focus()}
function closeCheckout(){const m=document.querySelector('#checkoutModal');if(m)m.classList.remove('open')}
async function submitCheckout(e){
  e.preventDefault();
  const btn=e.target.querySelector('.checkout-submit');const msg=document.querySelector('#checkoutMsg');
  btn.disabled=true;btn.textContent='A processar...';msg.style.display='block';msg.textContent='A criar a cobrança...';
  const game=document.querySelector('#checkoutGame').value;const pack=document.querySelector('#checkoutPack').value;const amount=Number(document.querySelector('#checkoutAmount').value);const playerId=document.querySelector('#playerId').value.trim();const msisdn=document.querySelector('#paymentNumber').value.trim();const method=document.querySelector('#paymentMethod').value;
  const reference=`GMZ-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  try{
    const res=await fetch(`${API}/create-order`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,currency:'MZN',method,msisdn,reference,game,pack,playerId})});
    const result=await res.json().catch(()=>({}));
    if(!res.ok||!result.ok){throw new Error(result?.data?.message||result?.data?.error||result?.error||`Erro HTTP ${res.status}`)}
    msg.textContent=`Cobrança criada com sucesso.\nReferência: ${reference}\n\nConfirme o pagamento no seu ${method==='mpesa'?'M-Pesa':'mKesh'} quando solicitado.`;
    document.querySelector('#checkoutForm').style.display='none';
  }catch(err){msg.textContent=`Não foi possível criar a cobrança.\n${err.message}\n\nTente novamente.`}
  finally{btn.disabled=false;btn.textContent='Continuar pagamento'}
}
ensureModal();
render(games);
document.querySelector('#search').addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();render(games.filter(g=>g.name.toLowerCase().includes(q)))});
