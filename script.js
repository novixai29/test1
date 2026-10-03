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
  dateSentence: 'وذلك بمشيئه الله تعالى يوم الجمعة المصادف التاسع من شهر اكتوبر التالي',
  // الأسطر منفصلة للتحكم بتسلسل أحجام النص؛ حدّثها مع dateSentence عند تغيير الموعد.
  dateLines: ['وذلك بمشيئه الله تعالى', 'يوم الجمعة المصادف', 'التاسع من شهر اكتوبر التالي'],
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
  endpoint: '',
  supabaseUrl: '',
  supabasePublicKey: '',
  supabaseTable: 'rsvps',
  timeoutMs: 15000
};

function toArabicDigits(value) {
  return String(value).replace(/[0-9]/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
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
    const headers = { 'Content-Type': 'application/json' };
    if (isSupabase) {
      headers.apikey = RSVP_CONFIG.supabasePublicKey;
      headers.Authorization = `Bearer ${RSVP_CONFIG.supabasePublicKey}`;
      headers.Prefer = 'return=minimal';
    }
    const response = await fetch(url, {
      method: 'POST', headers, body: JSON.stringify(data), signal: controller.signal,
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
let opened = false;
let submitting = false;
let musicStatusTimer;

document.body.classList.add('js-ready');
document.querySelectorAll('[data-event]').forEach(element => {
  const value = EVENT[element.dataset.event];
  if (typeof value === 'string') element.textContent = toArabicDigits(value);
});
document.getElementById('mapsLink').href = EVENT.mapsUrl;
if (music.getAttribute('src') !== EVENT.musicFile) music.src = EVENT.musicFile;
music.volume = 0.4;
const dateSentence = document.getElementById('dateSentence');
dateSentence.replaceChildren();
EVENT.dateLines.forEach((line, index) => {
  if (index) dateSentence.append(document.createElement('br'));
  const text = document.createElement(index ? 'strong' : 'span');
  text.textContent = toArabicDigits(line);
  dateSentence.append(text);
});
document.querySelector('.date-composition p').textContent = toArabicDigits(EVENT.dateLines[2]);
countSelect.replaceChildren();
for (let count = 0; count <= 20; count++) {
  countSelect.add(new Option(toArabicDigits(count), String(count)));
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
    label.textContent = `اسم المرافق ${toArabicDigits(index + 1)}`;
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
    ? `عدد حقول أسماء المرافقين: ${toArabicDigits(count)}` : 'بدون مرافقين';
  formMessage.textContent = '';
}
countSelect.addEventListener('change', renderCompanionFields);

// تحويل الأرقام المكتوبة أيضاً، حتى لا تظهر أرقام لاتينية في الحقول أو رسالة النجاح.
form.addEventListener('input', event => {
  if (!(event.target instanceof HTMLInputElement)) return;
  const input = event.target;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const converted = toArabicDigits(input.value).replace(/[۰-۹]/g, digit => '٠١٢٣٤٥٦٧٨٩'['۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)]);
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
        : `يرجى كتابة اسم المرافق ${toArabicDigits(Number(input.dataset.index) + 1)}.`;
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
    document.getElementById('successGuest').textContent = toArabicDigits(data.guest_name);
    document.getElementById('successCount').textContent = `عدد المرافقين: ${toArabicDigits(count)}`;
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
