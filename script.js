'use strict';

const EVENT = {
  eventId: 'zain-fatima-aqd',
  groomTitle: 'الدكتور',
  groom: 'زين العابدين',
  brideTitle: 'الدكتورة',
  bride: 'فاطمة',
  hostOne: 'السيد ضرغام ناصر الموسوي',
  hostTwo: 'السيد ازهر صاحب الشمري',
  invitationText: 'يتشرف السيد ضرغام ناصر الموسوي والسيد ازهر صاحب الشمري ان يدعو حضراتكم الكرام لمشاركتهم عقد قران الدكتور زين العابدين والدكتورة فاطمة',
  dateSentence: 'يوم الجمعة المصادف التاسع من شهر اكتوبر الحالي تكون مشية الرجال في تمام الساعة الثالثة ظهرا و حفل الخطوبة الساعة الخامسة مساءا في مزرعة آرام',
  // بداية المناسبة: مشية الرجال، بتوقيت بغداد.
  eventDateTime: '2026-10-09T15:00:00+03:00',
  dateLines: ['يوم الجمعة المصادف', 'التاسع من شهر اكتوبر الحالي تكون مشية الرجال في تمام الساعة الثالثة ظهرا و حفل الخطوبة الساعة الخامسة مساءا في مزرعة آرام'],
  dayName: 'الجمعة',
  mapsUrl: 'https://maps.app.goo.gl/cZ5Kbs4vbKYyXbnW6?g_st=it',
  musicFile: 'assets/music.mp3',
  previewImage: 'assets/preview.jpg'
};

// GitHub Pages يستضيف الملفات فقط ولا يستقبل بيانات النموذج.
// اختر إعداداً واحداً: endpoint لخدمة POST تعيد { success: true } بعد حفظ البيانات،
// أو Supabase مع anon/publishable key فقط، وجدول يحوي أعمدة بنية البيانات أدناه.
// فعّل RLS وسياسة INSERT المناسبة، وقيود event_id/count/JSON، ومكافحة الرسائل المزعجة في الخدمة.
// لا تضع service_role key أو كلمة مرور أو مفتاحاً سرياً هنا.
const RSVP_CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbzI0SSeI6XhA1kHg1LEW3NEoDtDS8IW1SePLcJiPzlo7V7K0ulk85hTY6s_GjsYuZxLfw/exec',
  // رابط GET آمن يعيد { guests: [...] }. لا تضع مفتاح إدارة سرياً في هذا الملف.
  dashboardEndpoint: 'https://script.google.com/macros/s/AKfycbzI0SSeI6XhA1kHg1LEW3NEoDtDS8IW1SePLcJiPzlo7V7K0ulk85hTY6s_GjsYuZxLfw/exec',
  supabaseUrl: '',
  supabasePublicKey: '',
  supabaseTable: 'rsvps',
  timeoutMs: 15000
};

function toEnglishDigits(value) {
  return String(value).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

/** نقطة التكامل المستقلة. لا تعتبر الإرسال ناجحاً إلا بعد حفظ الخدمة للبيانات. */
async function submitRSVP(data) {
  const isSupabase = !RSVP_CONFIG.endpoint && RSVP_CONFIG.supabaseUrl && RSVP_CONFIG.supabasePublicKey;
  if (!RSVP_CONFIG.endpoint && !isSupabase) {
    throw new Error('RSVP_NOT_CONFIGURED');
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), RSVP_CONFIG.timeoutMs);
  try {
    const url = isSupabase
      ? `${RSVP_CONFIG.supabaseUrl.replace(/\/$/, '')}/rest/v1/${encodeURIComponent(RSVP_CONFIG.supabaseTable)}`
      : RSVP_CONFIG.endpoint;
    const headers = { 'Content-Type': isSupabase ? 'application/json' : 'text/plain;charset=utf-8' };
    if (isSupabase) {
      headers.apikey = RSVP_CONFIG.supabasePublicKey;
      headers.Authorization = `Bearer ${RSVP_CONFIG.supabasePublicKey}`;
      headers.Prefer = 'return=minimal';
    }
    const response = await fetch(url, {
      method: 'POST', headers, body: JSON.stringify({ action: 'register', ...data }), signal: controller.signal,
      credentials: 'omit', cache: 'no-store'
    });
    if (!response.ok) throw new Error('RSVP_FAILED');
    if (!isSupabase) {
      const result = await response.json();
      if (result.success !== true) throw new Error('RSVP_FAILED');
    }
    return { success: true };
  } finally {
    window.clearTimeout(timeout);
  }
}

const opening = document.getElementById('opening');
const invitation = document.getElementById('invitation');
const openButton = document.getElementById('openInvitation');
const music = document.getElementById('weddingMusic');
const musicControl = document.getElementById('musicControl');
const musicButton = document.getElementById('musicToggle');
const musicStatus = document.getElementById('musicStatus');
const form = document.getElementById('rsvpForm');
const guestInput = document.getElementById('guestName');
const countSelect = document.getElementById('companionsCount');
const companionContainer = document.getElementById('companionFields');
const formMessage = document.getElementById('formMessage');
const submitButton = document.getElementById('submitButton');
const savedCompanions = Array(20).fill('');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const isDashboardView = new URLSearchParams(window.location.search).get('view') === 'guests';
let opened = false;
let submitting = false;
let musicStatusTimer;

document.body.classList.add('js-ready');
document.querySelectorAll('[data-event]').forEach(element => {
  const value = EVENT[element.dataset.event];
  if (typeof value === 'string') element.textContent = toEnglishDigits(value);
});
document.getElementById('mapsLink').href = EVENT.mapsUrl;
if (music.getAttribute('src') !== EVENT.musicFile) music.src = EVENT.musicFile;
music.volume = 0.4;
const dateSentence = document.getElementById('dateSentence');
dateSentence.replaceChildren();
EVENT.dateLines.forEach((line, index) => {
  if (index) dateSentence.append(document.createElement('br'));
  const text = document.createElement('strong');
  text.textContent = toEnglishDigits(line);
  dateSentence.append(text);
});
document.querySelector('.date-composition p').textContent = 'التاسع من شهر اكتوبر الحالي';
countSelect.replaceChildren();
for (let count = 0; count <= 20; count++) {
  countSelect.add(new Option(toEnglishDigits(count), String(count)));
}

function updateMusicButton() {
  const playing = !music.paused && !music.ended;
  musicButton.setAttribute('aria-pressed', String(playing));
  musicButton.setAttribute('aria-label', playing ? 'إيقاف الموسيقى مؤقتاً' : 'تشغيل الموسيقى');
}
function showMusicMessage(text) {
  window.clearTimeout(musicStatusTimer);
  musicStatus.textContent = text;
  musicStatusTimer = window.setTimeout(() => { musicStatus.textContent = ''; }, 5000);
}
function playMusic() {
  // الاستدعاء مباشرة في معالج الضغط للحفاظ على user activation.
  const playback = music.play();
  if (playback && typeof playback.catch === 'function') {
    playback.catch(() => {
      updateMusicButton();
      showMusicMessage('تعذّر تشغيل الموسيقى. يمكنك المحاولة من الزر.');
    });
  }
}
music.addEventListener('play', updateMusicButton);
music.addEventListener('pause', updateMusicButton);
music.addEventListener('ended', updateMusicButton);
music.addEventListener('error', updateMusicButton);
musicButton.addEventListener('click', () => {
  if (music.paused) playMusic();
  else music.pause();
});

function formatGuestDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return toEnglishDigits(new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(date));
}

function normalizeGuest(record) {
  const companions = Array.isArray(record.companions)
    ? record.companions.map(name => String(name || '').trim()).filter(Boolean)
    : [];
  const parsedCount = Number(record.companions_count);
  return {
    id: String(record.id || ''),
    name: String(record.guest_name || '').trim(),
    count: Number.isInteger(parsedCount) && parsedCount >= 0 ? Math.min(parsedCount, companions.length) : companions.length,
    companions,
    createdAt: record.created_at || record.submitted_at || ''
  };
}

function renderGuestDashboard(records) {
  const guests = records.map(normalizeGuest).filter(guest => guest.name);
  const companionsTotal = guests.reduce((sum, guest) => sum + guest.count, 0);
  document.getElementById('registeredGuests').textContent = toEnglishDigits(guests.length);
  document.getElementById('totalCompanions').textContent = toEnglishDigits(companionsTotal);
  document.getElementById('totalAttendees').textContent = toEnglishDigits(guests.length + companionsTotal);
  const list = document.getElementById('guestList');
  list.replaceChildren();
  if (!guests.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-guests';
    empty.textContent = 'لا توجد تسجيلات حضور حتى الآن.';
    list.append(empty);
    return;
  }
  guests.forEach((guest, index) => {
    const article = document.createElement('article');
    article.className = 'guest-record';
    const head = document.createElement('div');
    head.className = 'guest-record-head';
    const title = document.createElement('h2');
    title.textContent = guest.name;
    const number = document.createElement('span');
    number.className = 'guest-number';
    number.textContent = toEnglishDigits(index + 1);
    const actions = document.createElement('div');
    actions.className = 'guest-record-actions no-print';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-guest';
    remove.textContent = 'حذف التسجيل';
    remove.disabled = !guest.id;
    remove.addEventListener('click', () => deleteGuest(guest.id, guest.name, remove));
    actions.append(remove, number);
    head.append(title, actions);
    const meta = document.createElement('div');
    meta.className = 'guest-meta';
    const count = document.createElement('span');
    count.textContent = `عدد المرافقين: ${toEnglishDigits(guest.count)}`;
    meta.append(count);
    const date = formatGuestDate(guest.createdAt);
    if (date) {
      const registered = document.createElement('span');
      registered.textContent = `وقت التسجيل: ${date}`;
      meta.append(registered);
    }
    article.append(head, meta);
    if (guest.count) {
      const companionBox = document.createElement('div');
      companionBox.className = 'guest-companions';
      const heading = document.createElement('strong');
      heading.textContent = 'أسماء المرافقين';
      const names = document.createElement('ol');
      guest.companions.slice(0, guest.count).forEach(name => {
        const item = document.createElement('li');
        item.textContent = name;
        names.append(item);
      });
      companionBox.append(heading, names);
      article.append(companionBox);
    }
    list.append(article);
  });
}

async function loadGuestDashboard() {
  const status = document.getElementById('dashboardStatus');
  status.className = 'dashboard-status';
  const accessKey = decodeURIComponent(window.location.hash.slice(1));
  if (!RSVP_CONFIG.dashboardEndpoint) {
    status.classList.add('error');
    status.textContent = 'لم يتم ربط سجل الحضور بقاعدة البيانات بعد.';
    renderGuestDashboard([]);
    return;
  }
  if (!accessKey) {
    status.classList.add('error');
    status.textContent = 'رابط العرسان غير مكتمل. افتح الرابط الإداري الخاص بكم.';
    renderGuestDashboard([]);
    return;
  }
  status.textContent = 'جارٍ تحميل قائمة الحضور…';
  try {
    const joiner = RSVP_CONFIG.dashboardEndpoint.includes('?') ? '&' : '?';
    const response = await fetch(`${RSVP_CONFIG.dashboardEndpoint}${joiner}action=list&key=${encodeURIComponent(accessKey)}`, { credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('DASHBOARD_FAILED');
    const result = await response.json();
    const records = Array.isArray(result) ? result : result.guests;
    if (!Array.isArray(records)) throw new Error('DASHBOARD_FAILED');
    renderGuestDashboard(records);
    status.textContent = `آخر تحديث: ${formatGuestDate(new Date().toISOString())}`;
  } catch (_) {
    status.classList.add('error');
    status.textContent = 'تعذّر تحميل قائمة الحضور. يرجى المحاولة مرة أخرى.';
  }
}

async function deleteGuest(id, name, button) {
  if (!id || !RSVP_CONFIG.dashboardEndpoint) return;
  if (!window.confirm(`هل تريد حذف تسجيل ${name}؟`)) return;
  const accessKey = decodeURIComponent(window.location.hash.slice(1));
  button.disabled = true;
  button.textContent = 'جارٍ الحذف…';
  try {
    const response = await fetch(RSVP_CONFIG.dashboardEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', id, key: accessKey }),
      credentials: 'omit',
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('DELETE_FAILED');
    const result = await response.json();
    if (result.success !== true) throw new Error('DELETE_FAILED');
    await loadGuestDashboard();
  } catch (_) {
    const status = document.getElementById('dashboardStatus');
    status.className = 'dashboard-status error';
    status.textContent = 'تعذّر حذف التسجيل. يرجى المحاولة مرة أخرى.';
    button.disabled = false;
    button.textContent = 'حذف التسجيل';
  }
}

if (isDashboardView) {
  document.body.classList.remove('is-closed');
  document.body.classList.add('guest-dashboard-mode');
  opening.hidden = true;
  invitation.hidden = true;
  musicControl.hidden = true;
  const dashboard = document.getElementById('guestDashboard');
  dashboard.hidden = false;
  document.getElementById('refreshGuests').addEventListener('click', loadGuestDashboard);
  document.getElementById('printGuests').addEventListener('click', () => window.print());
  loadGuestDashboard();
}

function updateCountdown() {
  const target = new Date(EVENT.eventDateTime).getTime();
  const remaining = Math.max(0, target - Date.now());
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  document.getElementById('countdownDays').textContent = String(days);
  document.getElementById('countdownHours').textContent = String(hours).padStart(2, '0');
  document.getElementById('countdownMinutes').textContent = String(minutes).padStart(2, '0');
  document.getElementById('countdownSeconds').textContent = String(seconds).padStart(2, '0');
  document.getElementById('countdown').setAttribute('aria-label', `${days} يوم و${hours} ساعة و${minutes} دقيقة و${seconds} ثانية`);
  if (remaining === 0) {
    document.getElementById('countdownMessage').textContent = 'حلّ موعد المناسبة — أهلاً وسهلاً بكم';
  }
}

if (!isDashboardView) {
  updateCountdown();
  window.setInterval(updateCountdown, 1000);
}

let revealObserver;
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
}
openButton.addEventListener('click', () => {
  if (opened) return;
  opened = true;
  openButton.disabled = true;
  playMusic();
  opening.classList.add('is-opening');
  window.setTimeout(() => {
    invitation.removeAttribute('inert');
    invitation.removeAttribute('aria-hidden');
    document.body.classList.remove('is-closed');
    document.body.classList.add('is-open');
    opening.hidden = true;
    musicControl.hidden = false;
    const heading = document.getElementById('couple-heading');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    document.querySelectorAll('.reveal').forEach(card => {
      if (revealObserver) revealObserver.observe(card);
      else card.classList.add('is-visible');
    });
  }, reducedMotion.matches ? 0 : 2000);
});

function getCompanionsCount() {
  const count = Number(countSelect.value);
  return Number.isInteger(count) && count >= 0 && count <= 20 ? count : 0;
}

function renderCompanionFields() {
  const count = getCompanionsCount();
  // الموجود يبقى نفسه عند الزيادة، وتُحذف الحقول الزائدة فقط عند التقليل.
  while (companionContainer.children.length > count) {
    companionContainer.lastElementChild.remove();
  }
  for (let index = companionContainer.children.length; index < count; index++) {
    const field = document.createElement('div');
    field.className = 'field companion-field';
    const label = document.createElement('label');
    label.htmlFor = `companion-${index}`;
    label.textContent = `اسم المرافق ${toEnglishDigits(index + 1)}`;
    const input = document.createElement('input');
    input.id = label.htmlFor;
    input.name = `companion_${index}`;
    input.type = 'text';
    input.required = true;
    input.maxLength = 150;
    input.autocomplete = 'off';
    input.placeholder = 'اكتب الاسم الكامل';
    input.value = savedCompanions[index];
    input.dataset.index = String(index);
    const error = document.createElement('p');
    error.className = 'field-error';
    error.id = `${input.id}-error`;
    input.setAttribute('aria-describedby', error.id);
    input.addEventListener('input', () => {
      savedCompanions[index] = input.value;
      clearFieldError(input);
    });
    field.append(label, input, error);
    companionContainer.append(field);
  }
  document.getElementById('companionAnnouncement').textContent = count
    ? `عدد حقول أسماء المرافقين: ${toEnglishDigits(count)}` : 'بدون مرافقين';
  formMessage.textContent = '';
}
countSelect.addEventListener('change', renderCompanionFields);

// توحيد الأرقام المكتوبة لتظهر بالصيغة الإنجليزية في جميع الحقول والرسائل.
form.addEventListener('input', event => {
  if (!(event.target instanceof HTMLInputElement)) return;
  const input = event.target;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const converted = toEnglishDigits(input.value);
  if (input.value !== converted) {
    input.value = converted;
    input.setSelectionRange(start, end);
  }
  if (input.dataset.index !== undefined) savedCompanions[Number(input.dataset.index)] = input.value;
});
function clearFieldError(input) {
  input.removeAttribute('aria-invalid');
  document.getElementById(`${input.id}-error`).textContent = '';
  formMessage.textContent = '';
}
guestInput.addEventListener('input', () => clearFieldError(guestInput));

function validateForm() {
  let firstInvalid;
  const activeInputs = [guestInput, ...companionContainer.querySelectorAll('input')];
  activeInputs.forEach(input => {
    clearFieldError(input);
    if (!input.value.trim()) {
      input.setAttribute('aria-invalid', 'true');
      document.getElementById(`${input.id}-error`).textContent = input === guestInput
        ? 'يرجى كتابة اسم الشخص المدعو.'
        : `يرجى كتابة اسم المرافق ${toEnglishDigits(Number(input.dataset.index) + 1)}.`;
      if (!firstInvalid) firstInvalid = input;
    }
  });
  if (firstInvalid) {
    formMessage.textContent = 'يرجى إكمال الأسماء المطلوبة لتأكيد الحضور.';
    firstInvalid.focus();
    return false;
  }
  return true;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !validateForm()) return;
  const count = getCompanionsCount();
  const data = {
    event_id: EVENT.eventId,
    guest_name: guestInput.value.trim(),
    companions_count: count,
    companions: Array.from(companionContainer.querySelectorAll('input'), input => input.value.trim())
  };
  submitting = true;
  submitButton.disabled = true;
  submitButton.classList.add('is-submitting');
  form.setAttribute('aria-busy', 'true');
  form.querySelectorAll('input, select').forEach(input => { input.disabled = true; });
  submitButton.querySelector('.button-label').textContent = 'جارٍ تأكيد الحضور';
  formMessage.textContent = '';
  try {
    await submitRSVP(data);
    document.getElementById('successGuest').textContent = toEnglishDigits(data.guest_name);
    document.getElementById('successCount').textContent = `عدد المرافقين: ${toEnglishDigits(count)}`;
    form.hidden = true;
    const success = document.getElementById('rsvpSuccess');
    success.hidden = false;
    success.focus({ preventScroll: true });
    success.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  } catch (error) {
    formMessage.textContent = error.message === 'RSVP_NOT_CONFIGURED'
      ? 'خدمة تأكيد الحضور غير متاحة حالياً. يرجى المحاولة لاحقاً.'
      : 'تعذّر تأكيد الحضور. يرجى التحقق من الاتصال والمحاولة مرة أخرى.';
    formMessage.focus({ preventScroll: true });
  } finally {
    submitting = false;
    submitButton.disabled = false;
    submitButton.classList.remove('is-submitting');
    submitButton.querySelector('.button-label').textContent = 'تأكيد الحضور';
    form.removeAttribute('aria-busy');
    form.querySelectorAll('input, select').forEach(input => { input.disabled = false; });
  }
});
