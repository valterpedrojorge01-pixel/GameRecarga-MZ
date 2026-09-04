const games=[
  {name:'Call of Duty Mobile',mark:'COD',packs:[['80 CP',80],['420 CP',390],['880 CP',760],['2400 CP',1890]]},
  {name:'Free Fire',mark:'FF',packs:[['100 Diamantes',85],['310 Diamantes',245],['520 Diamantes',395],['1060 Diamantes',790]]},
  {name:'Mobile Legends',mark:'ML',packs:[['86 Diamonds',75],['172 Diamonds',145],['257 Diamonds',210],['706 Diamonds',520]]},
  {name:'PUBG Mobile',mark:'PUBG',packs:[['60 UC',75],['325 UC',365],['660 UC',690],['1800 UC',1790]]},
  {name:'Roblox',mark:'RBX',packs:[['80 Robux',85],['400 Robux',390],['800 Robux',720],['1700 Robux',1450]]},
  {name:'EA FC Mobile',mark:'FC',packs:[['100 FC Points',95],['520 FC Points',450],['1050 FC Points',850],['2200 FC Points',1690]]}
];
const money=n=>new Intl.NumberFormat('pt-MZ').format(n)+' MT';
const grid=document.querySelector('#grid');
function render(list){grid.innerHTML=list.map(g=>`<article class="game"><div class="game-mark">${g.mark}</div><h3>${g.name}</h3><p>Pacotes disponíveis</p><div class="packs">${g.packs.map(p=>`<button class="pack" title="${g.name} — ${p[0]}" onclick="openStore()">${p[0]}<b>${money(p[1])}</b></button>`).join('')}</div><button class="buy" onclick="openStore()">Comprar</button></article>`).join('')}
function openStore(){window.location.href='https://app.buildy.so/misty-kestrel-4079/gamerecarga-mz#loja'}
render(games);
document.querySelector('#search').addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();render(games.filter(g=>g.name.toLowerCase().includes(q)))});
