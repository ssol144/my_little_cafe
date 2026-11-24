// Hand-made inline SVG icons (no external assets).
const svg = (body: string, vb = '0 0 64 64') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

const cup = (coffee: string, extra = '') =>
  svg(`<ellipse cx="32" cy="54" rx="24" ry="5" fill="#e9dcc6"/><path d="M12 22h36l-4 28a6 6 0 0 1-6 5H22a6 6 0 0 1-6-5z" fill="#fffaf0" stroke="#d9c7aa" stroke-width="2"/><path d="M48 28c8 0 9 12 0 13" fill="none" stroke="#fffaf0" stroke-width="5" stroke-linecap="round"/><ellipse cx="30" cy="22" rx="18" ry="5" fill="${coffee}"/>${extra}`);

export const MENU_ICONS: Record<string, string> = {
  americano: cup('#3a2014'),
  cappuccino: cup('#b98a5e', '<ellipse cx="30" cy="20" rx="14" ry="5" fill="#faf2e4"/><circle cx="26" cy="19" r="1.4" fill="#8a5a36"/><circle cx="33" cy="20" r="1.2" fill="#8a5a36"/>'),
  latte: cup('#c9a27a', '<path d="M30 25c-6-4-6-8-2-8 1 0 2 1 2 2 0-1 1-2 2-2 4 0 4 4-2 8z" fill="#fff"/>'),
  einspanner: svg('<ellipse cx="32" cy="56" rx="18" ry="4" fill="#e9dcc6"/><path d="M18 18h28l-3 36H21z" fill="#d6ecf2" opacity=".8"/><path d="M20 30h24l-2 24H22z" fill="#3a2014"/><ellipse cx="32" cy="20" rx="15" ry="9" fill="#fbf6ea"/><ellipse cx="28" cy="16" rx="6" ry="3" fill="#fff"/>'),
  croissant: svg('<ellipse cx="32" cy="50" rx="26" ry="6" fill="#fff" stroke="#e9dcc6" stroke-width="2"/><path d="M8 40c4-18 44-18 48 0-6-6-12-8-16-8-2 6-14 6-16 0-4 0-10 2-16 8z" fill="#d9973e"/><path d="M22 32c2 6 6 8 10 8s8-2 10-8" fill="none" stroke="#b9772a" stroke-width="2.5"/><path d="M14 37l8-5M50 37l-8-5" stroke="#b9772a" stroke-width="2.5"/>'),
  muffin: svg('<path d="M16 34h32l-4 20H20z" fill="#e9d7b6" stroke="#d9c7aa" stroke-width="2"/><path d="M18 36v16M26 36v18M34 36v18M42 36v16" stroke="#d9c7aa" stroke-width="2"/><path d="M12 34c0-14 40-14 40 0z" fill="#c98b4e"/><circle cx="24" cy="26" r="3" fill="#4a4e8c"/><circle cx="36" cy="24" r="3" fill="#4a4e8c"/><circle cx="31" cy="30" r="2.6" fill="#4a4e8c"/><circle cx="42" cy="30" r="2.4" fill="#4a4e8c"/>'),
  cinnamon: svg('<ellipse cx="32" cy="50" rx="26" ry="6" fill="#fff" stroke="#e9dcc6" stroke-width="2"/><ellipse cx="32" cy="38" rx="22" ry="12" fill="#b87436"/><path d="M32 38m-3 0a3 3 0 1 1 6 0a7 7 0 1 1-14 0a11 11 0 1 1 22 0" fill="none" stroke="#7d4419" stroke-width="2.5"/><path d="M14 34c6-6 30-8 36 0-4 4-8 0-12 3s-12 1-14-1-6 2-10-2z" fill="#fdf8ee"/>'),
};

export const ICON = {
  coin: svg('<circle cx="32" cy="32" r="24" fill="#f2c94c" stroke="#c9952a" stroke-width="4"/><circle cx="32" cy="32" r="15" fill="none" stroke="#e0ad36" stroke-width="3"/><path d="M28 24h8M32 24v16M27 40h10" stroke="#a8761c" stroke-width="4" stroke-linecap="round"/>'),
  gem: svg('<path d="M20 12h24l12 14-24 30L8 26z" fill="#7ec8d8"/><path d="M8 26h48L32 56z" fill="#5fb0c4"/><path d="M20 12l4 14 8-14 8 14 4-14" fill="none" stroke="#bfe8f2" stroke-width="2.5"/><path d="M24 26l8 30 8-30" fill="none" stroke="#a5dcea" stroke-width="2"/>'),
  star: svg('<path d="M32 6l7.6 16.4L58 25l-13 12.6L48 56 32 47 16 56l3-18.4L6 25l18.4-2.6z" fill="#f2c94c" stroke="#d9a530" stroke-width="2.5" stroke-linejoin="round"/>'),
  starEmpty: svg('<path d="M32 6l7.6 16.4L58 25l-13 12.6L48 56 32 47 16 56l3-18.4L6 25l18.4-2.6z" fill="#e8dcc8" stroke="#d6c5aa" stroke-width="2.5" stroke-linejoin="round"/>'),
  heart: svg('<path d="M32 54C8 38 6 22 16 15c7-5 13-1 16 5 3-6 9-10 16-5 10 7 8 23-16 39z" fill="#ef8a95"/><ellipse cx="22" cy="22" rx="4" ry="3" fill="#fff" opacity=".6"/>'),
  cafe: svg('<path d="M8 28L32 10l24 18v26H8z" fill="#c89a6a"/><path d="M4 30L32 8l28 22" fill="none" stroke="#8a6446" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="26" y="36" width="12" height="18" rx="2" fill="#8a9a5b"/><rect x="13" y="34" width="9" height="8" rx="1.5" fill="#fff3d6"/><rect x="42" y="34" width="9" height="8" rx="1.5" fill="#fff3d6"/>'),
  decor: svg('<path d="M14 54h36" stroke="#8a6446" stroke-width="5" stroke-linecap="round"/><path d="M22 54l3-18h14l3 18" fill="#c98b5e"/><path d="M32 36c-12-2-16-14-10-22 4 6 8 10 10 22zM32 36c12-2 16-14 10-22-4 6-8 10-10 22z" fill="#8a9a5b"/><path d="M32 36V12" stroke="#6f7d48" stroke-width="3"/>'),
  shop: svg('<path d="M10 24h44l-4 30H14z" fill="#f2c94c"/><path d="M10 24l4-12h36l4 12" fill="#e9b04a"/><path d="M22 30v-6a10 10 0 0 1 20 0v6" fill="none" stroke="#8a6446" stroke-width="4" stroke-linecap="round"/><path d="M8 24h48" stroke="#c9952a" stroke-width="4" stroke-linecap="round"/>'),
  quest: svg('<rect x="12" y="8" width="40" height="50" rx="6" fill="#fffaf0" stroke="#c89a6a" stroke-width="4"/><rect x="22" y="4" width="20" height="10" rx="4" fill="#8a9a5b"/><path d="M20 28l5 5 10-10M20 44h24" stroke="#8a9a5b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'),
  album: svg('<rect x="8" y="10" width="48" height="44" rx="6" fill="#ef8a95"/><rect x="14" y="16" width="36" height="26" rx="3" fill="#fffaf0"/><path d="M16 40l10-12 8 8 6-6 10 10z" fill="#8a9a5b"/><circle cx="42" cy="24" r="4" fill="#f2c94c"/>'),
  person: svg('<circle cx="32" cy="24" r="13" fill="#f3cfb3"/><path d="M12 58c2-14 10-20 20-20s18 6 20 20z" fill="#8a9a5b"/><path d="M19 22c0-10 26-12 26 0-6-4-20-4-26 0z" fill="#6b4a32"/>'),
  staff: svg('<circle cx="24" cy="24" r="10" fill="#f3cfb3"/><circle cx="42" cy="26" r="9" fill="#e7c99a"/><path d="M6 56c2-12 8-18 18-18s14 6 16 18z" fill="#c89a6a"/><path d="M30 56c2-10 6-15 12-15s12 5 14 15z" fill="#8a9a5b"/><rect x="18" y="8" width="12" height="7" rx="3" fill="#fff"/>'),
  calendar: svg('<rect x="8" y="12" width="48" height="44" rx="7" fill="#fffaf0" stroke="#c89a6a" stroke-width="4"/><path d="M8 24h48" stroke="#c89a6a" stroke-width="4"/><path d="M20 8v10M44 8v10" stroke="#8a6446" stroke-width="5" stroke-linecap="round"/><path d="M24 40l6 6 12-12" stroke="#ef8a95" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  gear: svg('<path d="M32 8l5 6 8-2 2 8 8 3-3 8 5 6-6 5 1 8-8 1-3 8-8-3-6 5-5-6-8 1-1-8-7-4 4-7-4-7 7-4 1-8 8 1z" fill="#c89a6a"/><circle cx="32" cy="32" r="9" fill="#fbf4e8"/>'),
  pause: svg('<rect x="16" y="12" width="11" height="40" rx="4" fill="#8a6446"/><rect x="37" y="12" width="11" height="40" rx="4" fill="#8a6446"/>'),
  play: svg('<path d="M20 12l32 20-32 20z" fill="#8a9a5b"/>'),
  craft: svg('<path d="M14 26h30l-3 26a6 6 0 0 1-6 5H23a6 6 0 0 1-6-5z" fill="#fff"/><path d="M44 30c8 0 8 12 0 12" stroke="#fff" stroke-width="5" fill="none"/><path d="M22 18c0-6 6-6 6-12M32 18c0-6 6-6 6-12" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none"/>'),
  serve: svg('<path d="M8 44h48" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M12 42a20 20 0 0 1 40 0z" fill="#fff"/><circle cx="32" cy="18" r="4" fill="#fff"/>'),
  hand: svg('<path d="M18 34V16a4 4 0 0 1 8 0v14V10a4 4 0 0 1 8 0v20-16a4 4 0 0 1 8 0v18-10a4 4 0 0 1 8 0v18c0 12-8 20-18 20-8 0-12-4-16-10l-8-12a4 4 0 0 1 6-5z" fill="#fff"/>'),
  close: svg('<path d="M18 18l28 28M46 18L18 46" stroke="#8a6446" stroke-width="7" stroke-linecap="round"/>'),
  lock: svg('<rect x="14" y="28" width="36" height="28" rx="6" fill="#b9a890"/><path d="M22 28v-8a10 10 0 0 1 20 0v8" fill="none" stroke="#b9a890" stroke-width="6"/>'),
  rotate: svg('<path d="M48 30a17 17 0 1 1-6-13" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M44 6l0 14-14 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
  box: svg('<path d="M8 22l24-12 24 12v24L32 58 8 46z" fill="#c89a6a"/><path d="M8 22l24 12 24-12M32 34v24" fill="none" stroke="#8a6446" stroke-width="3"/>'),
  expand: svg('<path d="M10 24V10h14M40 10h14v14M54 40v14H40M24 54H10V40" fill="none" stroke="#8a6446" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
  palette: svg('<path d="M32 6C16 6 6 18 6 32s10 26 24 26c4 0 6-2 6-5 0-4-4-5-4-9s3-6 7-6h7c8 0 12-6 12-12C58 14 46 6 32 6z" fill="#f4ead6" stroke="#c89a6a" stroke-width="3"/><circle cx="20" cy="26" r="5" fill="#ef8a95"/><circle cx="30" cy="16" r="5" fill="#f2c94c"/><circle cx="43" cy="20" r="5" fill="#8a9a5b"/><circle cx="18" cy="40" r="5" fill="#7ec8d8"/>'),
  check: svg('<path d="M14 34l12 12 24-26" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'),
  trash: svg('<path d="M16 20h32l-3 34H19z" fill="#fff"/><path d="M12 18h40M26 12h12" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'),
  wish: svg('<path d="M32 54C8 38 6 22 16 15c7-5 13-1 16 5 3-6 9-10 16-5 10 7 8 23-16 39z" fill="none" stroke="#ef8a95" stroke-width="5"/>'),
  wishOn: svg('<path d="M32 54C8 38 6 22 16 15c7-5 13-1 16 5 3-6 9-10 16-5 10 7 8 23-16 39z" fill="#ef8a95"/>'),
};

export const EMOTE_SVG: Record<string, string> = {
  heart: ICON.heart,
  note: svg('<path d="M24 46V14l26-6v32" fill="none" stroke="#8a6446" stroke-width="5"/><ellipse cx="18" cy="46" rx="8" ry="6" fill="#8a6446"/><ellipse cx="44" cy="40" rx="8" ry="6" fill="#8a6446"/>'),
  sweat: svg('<path d="M32 8C24 24 18 32 18 40a14 14 0 0 0 28 0c0-8-6-16-14-32z" fill="#7ec8d8"/>'),
  chat: svg('<path d="M8 14h48v28H26l-12 10v-10H8z" fill="#fff" stroke="#c89a6a" stroke-width="3"/><circle cx="22" cy="28" r="3.5" fill="#8a6446"/><circle cx="32" cy="28" r="3.5" fill="#8a6446"/><circle cx="42" cy="28" r="3.5" fill="#8a6446"/>'),
  flash: svg('<path d="M36 4L14 36h14l-4 24 26-36H36z" fill="#f2c94c" stroke="#d9a530" stroke-width="2"/>'),
  star: ICON.star,
  angry: svg('<circle cx="32" cy="32" r="22" fill="#e8796b"/><path d="M20 24l8 4M44 24l-8 4M22 44c6-6 14-6 20 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>'),
  zzz: svg('<text x="14" y="44" font-size="30" font-weight="bold" fill="#8a6446">z</text><text x="32" y="30" font-size="22" font-weight="bold" fill="#8a6446">z</text>'),
  book: svg('<path d="M8 14c8-4 16-4 24 2v38c-8-6-16-6-24-2z" fill="#8b3a3a"/><path d="M56 14c-8-4-16-4-24 2v38c8-6 16-6 24-2z" fill="#a84a4a"/>'),
};

export function stars(n: number, max = 3) {
  let s = '';
  for (let i = 0; i < max; i++) s += `<i class="ico star">${i < n ? ICON.star : ICON.starEmpty}</i>`;
  return s;
}
