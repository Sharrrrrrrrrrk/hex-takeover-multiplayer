import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, push, onValue, set,
  get, runTransaction, onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

/* ================= Firebase ================= */
const firebaseConfig = {
    apiKey: "AIzaSyCo8StZeM0NRGi9XoTfmTCe_VovLt8nGjw",
    authDomain: "my-game-d7829.firebaseapp.com",
    databaseURL: "https://my-game-d7829-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "my-game-d7829",
    storageBucket: "my-game-d7829.firebasestorage.app",
    messagingSenderId: "1037507538095",
    appId: "1:1037507538095:web:622371a6f117d60e6bb85a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ================= 玩家系統（修復） ================= */
let myId = localStorage.getItem("playerId");
if (!myId) {
  myId = crypto.randomUUID();
  localStorage.setItem("playerId", myId);
}

const playersRef = ref(db, "players");
let myPlayer = null;

runTransaction(playersRef, current => {
  if (!current) current = {};

  // 已存在 → 不重複加入
  if (current[myId]) {
    myPlayer = current[myId];
    return current;
  }

  const count = Object.keys(current).length;
  if (count >= 6) return;

  current[myId] = count + 1;
  myPlayer = current[myId];
  return current;
});

// ? 離線自動刪除
onDisconnect(ref(db, "players/" + myId)).remove();

/* ================= 聊天（修復排序） ================= */
const messagesRef = ref(db, "messages");

onValue(messagesRef, snap => {
  const data = snap.val();
  const box = document.getElementById("chatBox");
  box.innerHTML = "";
  if (!data) return;

  const msgs = Object.values(data).sort((a,b)=>a.time-b.time);

  msgs.forEach(m => {
    box.innerHTML += `<div><b>${m.name}:</b> ${m.text}</div>`;
  });

  box.scrollTop = box.scrollHeight;
});

document.getElementById("sendBtn").onclick = () => {
  const name = document.getElementById("name").value || "匿名";
  const text = document.getElementById("msg").value;
  if (!text) return;

  push(messagesRef, {
    name,
    text,
    time: Date.now()
  });

  document.getElementById("msg").value = "";
};

/* ================= 遊戲 ================= */
const boardRef = ref(db,"board");
const turnRef = ref(db,"turn");
const historyRef = ref(db,"history");

let grid = [];
let currentTurn = null;

/* ===== 限制 history 長度 ===== */
const MAX_HISTORY = 20;

function saveHistory(newState){
  runTransaction(historyRef, h => {
    if (!h) h = [];
    h.push(newState);
    if (h.length > MAX_HISTORY) h.shift();
    return h;
  });
}

/* ===== move 驗證（防作弊基本版） ===== */
function isValidMove(a,b){
  if (!a || !b) return false;
  if (b.owner !== 0) return false;
  const d = dist(a,b);
  return d===1 || d===2;
}

/* ===== 六角距離 ===== */
function dist(a,b){
  return (Math.abs(a.q-b.q)+Math.abs(a.q+a.r-b.q-b.r)+Math.abs(a.r-b.r))/2;
}

/* ===== 落子（改良） ===== */
function makeMove(a,b){

  if (!isValidMove(a,b)) return;

  runTransaction(boardRef, current => {
    if (!current) return current;

    let g = current.map(c=>({...c}));

    const ai = g.findIndex(h=>h.q===a.q && h.r===a.r);
    const bi = g.findIndex(h=>h.q===b.q && h.r===b.r);

    if (dist(a,b)===2) g[ai].owner = 0;
    g[bi].owner = myPlayer;

    g.forEach((h,i)=>{
      if(dist(b,h)===1 && h.owner!==0 && h.owner!==myPlayer){
        g[i].owner = myPlayer;
      }
    });

    saveHistory({grid:g, turn:currentTurn});

    return g;
  });

  // 換回合
  runTransaction(turnRef, t => (t % 6) + 1);
}

/* ===== 同步 ===== */
onValue(boardRef, snap=>{
  const data = snap.val();
  if (!data) return;
  grid = data;
});

onValue(turnRef, snap=>{
  currentTurn = snap.val();
});

/* ===== Canvas（保持簡化） ===== */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  grid.forEach(h=>{
    ctx.fillStyle = h.owner ? "#0ff" : "#333";
    ctx.fillRect(h.q*20+400,h.r*20+300,15,15);
  });

  requestAnimationFrame(draw);
}
draw();