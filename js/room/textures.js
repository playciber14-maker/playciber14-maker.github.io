// Текстуры, нарисованные на <canvas>: экран с кодом, телефон, стикеры, окно, постер.

import * as THREE from "three";

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d") };
}

function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---------- Монитор: бегущий код ---------- */
const CODE = [
  "from aiogram import Router, F",
  "from app.db import slots, bookings",
  "",
  "router = Router()",
  "",
  "@router.message(F.text == '/start')",
  "async def start(msg):",
  "    await msg.answer('Привет! Чем помочь?',",
  "                     reply_markup=main_menu())",
  "",
  "@router.callback_query(F.data == 'book')",
  "async def book(cb):",
  "    free = await slots.free(day=cb.data)",
  "    if not free:",
  "        return await cb.answer('Мест нет')",
  "    await cb.message.edit_text(",
  "        'Выберите время:', reply_markup=kb(free))",
  "",
  "# сайт: калькулятор цены",
  "const total = area * rate + extras",
  "render(total)",
  "",
  "def main_menu():",
  "    return keyboard(['Записаться', 'Цены'])",
];

function drawCodeLine(ctx, line, x, y) {
  if (line.trim().startsWith("#")) {
    ctx.fillStyle = "#6f6a8c";
    ctx.fillText(line, x, y);
    return;
  }
  // Простейшая подсветка: строки, ключевые слова, декораторы
  const parts = [];
  let rest = line;
  const re = /('[^']*'|@\w+(?:\.\w+)*|\b(?:from|import|async|def|await|return|if|not|const)\b)/;
  while (rest.length) {
    const m = rest.match(re);
    if (!m) { parts.push([rest, "#e6e3f5"]); break; }
    if (m.index > 0) parts.push([rest.slice(0, m.index), "#e6e3f5"]);
    const tok = m[0];
    const color = tok.startsWith("'") ? "#7ee2b8" : tok.startsWith("@") ? "#3cf2d6" : "#b79bff";
    parts.push([tok, color]);
    rest = rest.slice(m.index + tok.length);
  }
  let cx = x;
  for (const [text, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillText(text, cx, y);
    cx += ctx.measureText(text).width;
  }
}

export function codeScreen() {
  const W = 640, H = 368;
  const { c, ctx } = makeCanvas(W, H);
  const tex = toTexture(c);
  const lineH = 24;
  let offset = 0;
  let acc = 0;

  function draw(time) {
    ctx.fillStyle = "#17142a";
    ctx.fillRect(0, 0, W, H);
    // шапка редактора
    ctx.fillStyle = "#211d3a";
    ctx.fillRect(0, 0, W, 34);
    ["#ff6b81", "#ffc861", "#3cf2d6"].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(20 + i * 20, 17, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#9b95b3";
    ctx.font = "500 15px 'JetBrains Mono', monospace";
    ctx.fillText("bot.py — Quarsell", 92, 22);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 34, W, H - 34);
    ctx.clip();
    ctx.font = "16px 'JetBrains Mono', monospace";
    const first = Math.floor(offset / lineH);
    const shift = offset % lineH;
    for (let i = 0; i < 16; i++) {
      const idx = (first + i) % CODE.length;
      const y = 60 + i * lineH - shift;
      ctx.fillStyle = "#4a4566";
      ctx.fillText(String(idx + 1).padStart(2, " "), 14, y);
      drawCodeLine(ctx, CODE[idx], 52, y);
    }
    // мигающий курсор
    if (Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = "#3cf2d6";
      ctx.fillRect(52 + 9.6 * 22, 60 + 8 * lineH - shift - 15, 9, 18);
    }
    ctx.restore();
    tex.needsUpdate = true;
  }

  draw(0);
  return {
    texture: tex,
    update(dt, time) {
      acc += dt;
      if (acc < 1 / 15) return; // ~15 кадров в секунду достаточно
      offset += acc * 14;
      acc = 0;
      draw(time);
    },
  };
}

/* ---------- Телефон: уведомление ---------- */
export function phoneScreen() {
  const W = 200, H = 400;
  const { c, ctx } = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#7a5cff");
  g.addColorStop(1, "#18c9b0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.font = "700 52px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("12:30", W / 2, 110);
  // карточка уведомления
  ctx.fillStyle = "rgba(255,255,255,.92)";
  roundRect(ctx, 14, 160, W - 28, 92, 18);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = "#2aa3e0";
  ctx.beginPath();
  ctx.arc(40, 190, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e1a2b";
  ctx.font = "700 17px Manrope, sans-serif";
  ctx.fillText("Telegram", 62, 196);
  ctx.font = "500 15px Manrope, sans-serif";
  ctx.fillStyle = "#3d374d";
  ctx.fillText("Новая заявка!", 28, 232);
  return toTexture(c);
}

/* ---------- Стикер ---------- */
export function sticky(text, color, num) {
  const S = 160;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "rgba(0,0,0,.06)";
  ctx.fillRect(0, S - 18, S, 18);
  ctx.fillStyle = "rgba(30,26,43,.55)";
  ctx.font = "500 18px 'JetBrains Mono', monospace";
  ctx.fillText(num, 16, 32);
  ctx.fillStyle = "#1e1a2b";
  ctx.font = "800 26px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, S / 2, S / 2 + 18);
  return toTexture(c);
}

/* ---------- Окно: день и ночь ---------- */
export function windowView(night) {
  const W = 256, H = 256;
  const { c, ctx } = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (night) {
    g.addColorStop(0, "#0b0f33");
    g.addColorStop(1, "#33246b");
  } else {
    g.addColorStop(0, "#8fd3ff");
    g.addColorStop(1, "#e3f5ff");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (night) {
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`;
      ctx.fillRect(Math.random() * W, Math.random() * H * 0.75, 2, 2);
    }
    ctx.fillStyle = "#fff4d6";
    ctx.beginPath();
    ctx.arc(180, 70, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f1240";
    ctx.beginPath();
    ctx.arc(192, 62, 24, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#fff6c9";
    ctx.beginPath();
    ctx.arc(190, 64, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.95)";
    [[60, 80], [92, 72], [120, 84], [150, 150], [178, 142], [204, 152]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // горы
  ctx.fillStyle = night ? "#1c1640" : "#9ccfb9";
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, 200);
  ctx.lineTo(70, 150);
  ctx.lineTo(130, 196);
  ctx.lineTo(190, 140);
  ctx.lineTo(W, 190);
  ctx.lineTo(W, H);
  ctx.fill();
  return toTexture(c);
}

/* ---------- Постер ---------- */
export function poster() {
  const W = 256, H = 320;
  const { c, ctx } = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#18c9b0");
  g.addColorStop(1, "#7a5cff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.font = "700 150px Unbounded, Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Q", W / 2, 190);
  ctx.font = "500 20px 'JetBrains Mono', monospace";
  ctx.fillText("build · ship · repeat", W / 2, 270);
  return toTexture(c);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
