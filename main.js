const CONFIG = {
  BUSINESS_ID: 'hairstylebarbershop',
  GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxkqP_EestIgjFV15jSw2k80L9wC89oL_hg3mMplpab6HQX9yUKzaLedRIGz6XQrp9X/exec',
  BOOKING_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxkqP_EestIgjFV15jSw2k80L9wC89oL_hg3mMplpab6HQX9yUKzaLedRIGz6XQrp9X/exec'
};

const services = {
  haircuts: [
    { name: 'Classic Cut', description: 'Clean sides, tailored top, finished with care.', price: 250 },
    { name: 'Kids Cut', description: 'A comfortable, easy-going cut for little gents.', price: 150 },
    { name: 'Fade / Taper', description: 'Sharp gradients and a finish that stays fresh.', price: 350 },
    { name: 'Haircut + Wash', description: 'The full reset: cut, wash, blow-dry, done.', price: 450 }
  ],
  beard: [
    { name: 'Beard Trim', description: 'Shape, line-up, and a tidy finish.', price: 150 },
    { name: 'Hot Towel Shave', description: 'Old-school comfort with a smooth finish.', price: 300 },
    { name: 'Haircut + Beard', description: 'The complete sharp look, in one chair.', price: 450 },
    { name: 'Beard Color', description: 'Natural-looking tone and careful blending.', price: 400 }
  ],
  style: [
    { name: 'Hair Color', description: 'A considered color refresh with a clean finish.', price: 800 },
    { name: 'Hair Wash & Style', description: 'Wash, dry, and style for your next plan.', price: 250 },
    { name: 'Hair Spa', description: 'A nourishing scalp and hair treatment.', price: 500 },
    { name: 'Creative Styling', description: 'Texture, volume, and a style made for you.', price: 600 }
  ]
};

const state = {
  loyalty: { tab: 'daily', phone: '', type: 'daily', streak: 0, visits: 0, scanDates: [], alreadyCheckedInToday: false, calendarDate: new Date() },
  booking: { calendarDate: new Date(), date: '', time: '', unavailable: [], step: 'calendar' }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const formatNpr = (price) => `NPR ${price.toLocaleString('en-IN')}`;
const monthLabel = (date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const dateKey = (date) => { const year = date.getFullYear(); const month = `${date.getMonth() + 1}`.padStart(2, '0'); const day = `${date.getDate()}`.padStart(2, '0'); return `${year}-${month}-${day}`; };
const todayKey = dateKey(new Date());

function renderServices(category = 'haircuts') {
  $('#service-grid').innerHTML = services[category].map((service) => `<article class="service-card"><div><h3>${service.name}</h3><p>${service.description}</p></div><span class="service-price">${formatNpr(service.price)}</span></article>`).join('');
  lucide.createIcons();
}

function openModal(id) { const modal = document.getElementById(id); modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); document.body.classList.add('modal-open'); }
function closeModal(id) { const modal = document.getElementById(id); modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); if (!$('.modal-backdrop.open')) document.body.classList.remove('modal-open'); }
function showToast(message, tone = 'default') { const toast = $('#toast'); toast.querySelector('span').textContent = message; toast.classList.toggle('success', tone === 'success'); toast.classList.add('show'); window.clearTimeout(showToast.timeout); showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 4200); }

function renderLoyalty() {
  const { streak, visits, scanDates } = state.loyalty;
  $('#streak-count').textContent = `${streak} day${streak === 1 ? '' : 's'}`;
  $('#streak-summary').textContent = `${streak} day${streak === 1 ? '' : 's'}`;
  $('#visit-count').textContent = `${visits} / 10 visits`;
  $('#visit-summary').textContent = `${visits} / 10`;
  $('#streak-path').innerHTML = Array.from({ length: 7 }, (_, index) => `<div class="streak-day ${index < streak ? 'checked' : ''} ${index === streak ? 'current' : ''}"><i data-lucide="flame"></i><span>Day ${index + 1}</span></div>`).join('');
  $('#stamp-grid').innerHTML = Array.from({ length: 10 }, (_, index) => `<div class="stamp ${index < visits ? 'filled' : ''}"><span>${index + 1}</span></div>`).join('');
  renderCalendar('loyalty');
  lucide.createIcons();
}

function renderCalendar(kind) {
  const isBooking = kind === 'booking';
  const date = state[isBooking ? 'booking' : 'loyalty'].calendarDate;
  const target = $(isBooking ? '#booking-calendar' : '#loyalty-calendar');
  const monthTarget = $(isBooking ? '#booking-month' : '#loyalty-month');
  monthTarget.textContent = monthLabel(date);
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const dates = Array.from({ length: firstDay + daysInMonth }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const headers = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => `<span class="calendar-weekday">${day}</span>`).join('');
  const body = dates.map((day) => {
    if (!day) return '<span class="calendar-day empty"></span>';
    const current = new Date(date.getFullYear(), date.getMonth(), day);
    const key = dateKey(current);
    const past = key < todayKey;
    const checked = state.loyalty.scanDates.includes(key);
    const selectable = isBooking && !past;
    return `<button class="calendar-day ${past && isBooking ? 'disabled' : ''} ${key === todayKey ? 'today' : ''} ${checked ? 'checked' : ''} ${selectable ? 'selectable' : ''}" ${selectable ? `data-booking-date="${key}"` : 'disabled'}>${day}</button>`;
  }).join('');
  target.innerHTML = headers + body;
  if (isBooking) $$('#booking-calendar [data-booking-date]').forEach((button) => button.addEventListener('click', () => chooseBookingDate(button.dataset.bookingDate)));
}

async function requestJson(url, body) {
  if (!url || url.startsWith('PASTE_')) return { demo: true, unavailable: [], streak: state.loyalty.streak, visits: state.loyalty.visits, scanDates: state.loyalty.scanDates, alreadyCheckedInToday: false };
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error('Request failed');
  return response.json();
}

function openLoyalty() { renderLoyalty(); openModal('loyalty-modal'); }
function beginCheckIn(type) { state.loyalty.type = type; $('#loyalty-phone').value = state.loyalty.phone; $('#pin-message').textContent = ''; closeModal('loyalty-modal'); openModal('phone-modal'); }
async function submitCheckIn() {
  state.loyalty.phone = $('#loyalty-phone').value.trim();
  if (!state.loyalty.phone) return;
  closeModal('phone-modal'); $('#staff-pin').value = ''; $('#pin-message').textContent = ''; openModal('pin-modal');
}
async function verifyCheckIn() {
  const message = $('#pin-message');
  if ($('#staff-pin').value !== '1234') { message.textContent = 'That PIN does not match. Please ask the team at the counter.'; return; }
  const button = $('#pin-form button'); button.disabled = true; button.textContent = 'Checking in…';
  try {
    const result = await requestJson(CONFIG.GOOGLE_SCRIPT_URL, { businessId: CONFIG.BUSINESS_ID, phone: state.loyalty.phone, type: state.loyalty.type });
    state.loyalty.streak = Number(result.streak || 0); state.loyalty.visits = Number(result.visits || 0); state.loyalty.scanDates = Array.isArray(result.scanDates) ? result.scanDates : []; state.loyalty.alreadyCheckedInToday = Boolean(result.alreadyCheckedInToday);
    closeModal('pin-modal'); openLoyalty();
    showToast(state.loyalty.alreadyCheckedInToday ? 'You are already checked in today. Keep that streak glowing.' : `New check-in locked. ${state.loyalty.type === 'daily' ? 'Your streak' : 'Your passport'} just got stronger.`, state.loyalty.alreadyCheckedInToday ? 'default' : 'success');
  } catch (error) { message.textContent = 'We could not reach the rewards desk. Please try again at the counter.'; } finally { button.disabled = false; button.innerHTML = 'Confirm Check-in <i data-lucide="check"></i>'; lucide.createIcons(); }
}

function resetBooking() { state.booking = { calendarDate: new Date(), date: '', time: '', unavailable: [], step: 'calendar' }; ['booking-calendar-view', 'booking-slots-view', 'booking-details-view', 'booking-success-view'].forEach((id, index) => $(`#${id}`).classList.toggle('hidden', index !== 0)); $$('#booking-modal [data-step-indicator]').forEach((el, index) => el.classList.toggle('active', index === 0)); renderCalendar('booking'); }
function openBooking() { resetBooking(); openModal('booking-modal'); }
async function chooseBookingDate(date) { state.booking.date = date; $('#selected-date-label').textContent = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); $('#booking-calendar-view').classList.add('hidden'); $('#booking-slots-view').classList.remove('hidden'); updateBookingStep(2); $('#slot-grid').innerHTML = '<p class="calendar-hint">Checking chair availability…</p>'; try { const result = await requestJson(CONFIG.BOOKING_SCRIPT_URL, { businessId: CONFIG.BUSINESS_ID, type: 'availability', date }); state.booking.unavailable = Array.isArray(result.unavailable) ? result.unavailable : []; renderSlots(); } catch (error) { $('#slot-grid').innerHTML = '<p class="form-message">We could not load availability. Please try again.</p>'; } }
function renderSlots() { const times = ['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM']; $('#slot-grid').innerHTML = times.map((time) => `<button class="slot ${state.booking.unavailable.includes(time) ? 'unavailable' : ''}" ${state.booking.unavailable.includes(time) ? 'disabled' : ''} data-time="${time}">${time}</button>`).join(''); $$('#slot-grid .slot:not(.unavailable)').forEach((button) => button.addEventListener('click', () => chooseBookingTime(button.dataset.time))); }
function chooseBookingTime(time) { state.booking.time = time; $('#selected-slot-label').textContent = `${state.booking.date} · ${time}`; $('#booking-slots-view').classList.add('hidden'); $('#booking-details-view').classList.remove('hidden'); updateBookingStep(3); $('#booking-message').textContent = ''; }
function updateBookingStep(step) { $$('#booking-modal [data-step-indicator]').forEach((el, index) => el.classList.toggle('active', index < step)); }
async function submitBooking(event) { event.preventDefault(); const form = $('#booking-form'); const button = form.querySelector('button'); const message = $('#booking-message'); const data = { businessId: CONFIG.BUSINESS_ID, date: state.booking.date, time: state.booking.time, name: $('#booking-name').value.trim(), phone: $('#booking-phone').value.trim(), service: $('#booking-service').value }; button.disabled = true; button.textContent = 'Confirming…'; message.textContent = ''; try { const result = await requestJson(CONFIG.BOOKING_SCRIPT_URL, data); if (result.booked === false || result.success === false || result.error === 'SLOT_TAKEN') { message.textContent = 'That slot was just booked — please pick another.'; state.booking.unavailable.push(state.booking.time); $('#booking-details-view').classList.add('hidden'); $('#booking-slots-view').classList.remove('hidden'); updateBookingStep(2); renderSlots(); return; } $('#booking-details-view').classList.add('hidden'); $('#booking-success-view').classList.remove('hidden'); $('#booking-success-copy').textContent = `${data.date} at ${data.time} is reserved for ${data.name}. We will see you soon.`; } catch (error) { message.textContent = 'We could not confirm that just yet. Please try again.'; } finally { button.disabled = false; button.innerHTML = 'Confirm Booking <i data-lucide="arrow-up-right"></i>'; lucide.createIcons(); } }

function init() {
  renderServices();
  const select = $('#booking-service'); select.innerHTML = Object.values(services).flat().map((service) => `<option value="${service.name}">${service.name} — ${formatNpr(service.price)}</option>`).join('');
  renderCalendar('booking'); renderLoyalty(); lucide.createIcons();
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => { $$('.tab').forEach((item) => item.classList.remove('active')); tab.classList.add('active'); renderServices(tab.dataset.category); }));
  $$('.loyalty-tab').forEach((tab) => tab.addEventListener('click', () => { $$('.loyalty-tab').forEach((item) => item.classList.remove('active')); tab.classList.add('active'); const daily = tab.dataset.loyaltyTab === 'daily'; $('#daily-panel').classList.toggle('hidden', !daily); $('#visit-panel').classList.toggle('hidden', daily); }));
  $('#loyalty-fab').addEventListener('click', openLoyalty); $$('[data-open-booking]').forEach((button) => button.addEventListener('click', openBooking)); $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
  $$('[data-check-in]').forEach((button) => button.addEventListener('click', () => beginCheckIn(button.dataset.checkIn))); $('#phone-form').addEventListener('submit', (event) => { event.preventDefault(); submitCheckIn(); }); $('#pin-form').addEventListener('submit', (event) => { event.preventDefault(); verifyCheckIn(); }); $('#booking-form').addEventListener('submit', submitBooking);
  $$('[data-calendar-prev]').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.calendarPrev === 'booking' ? 'booking' : 'loyalty'; state[key].calendarDate = new Date(state[key].calendarDate.getFullYear(), state[key].calendarDate.getMonth() - 1, 1); renderCalendar(key); })); $$('[data-calendar-next]').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.calendarNext === 'booking' ? 'booking' : 'loyalty'; state[key].calendarDate = new Date(state[key].calendarDate.getFullYear(), state[key].calendarDate.getMonth() + 1, 1); renderCalendar(key); }));
  $$('[data-booking-back]').forEach((button) => button.addEventListener('click', () => { const target = button.dataset.bookingBack; $('#booking-details-view').classList.toggle('hidden', target !== 'slots'); $('#booking-slots-view').classList.toggle('hidden', target !== 'slots'); $('#booking-calendar-view').classList.toggle('hidden', target !== 'calendar'); updateBookingStep(target === 'calendar' ? 1 : 2); }));
  $('#menu-button').addEventListener('click', () => { const expanded = $('#menu-button').getAttribute('aria-expanded') === 'true'; $('#menu-button').setAttribute('aria-expanded', String(!expanded)); $('#mobile-nav').classList.toggle('open', !expanded); $('#menu-button').innerHTML = `<i data-lucide="${expanded ? 'menu' : 'x'}"></i>`; lucide.createIcons(); }); $$('#mobile-nav a').forEach((link) => link.addEventListener('click', () => { $('#mobile-nav').classList.remove('open'); $('#menu-button').setAttribute('aria-expanded', 'false'); }));
  window.addEventListener('scroll', () => $('#site-header').classList.toggle('scrolled', window.scrollY > 30)); const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('visible'); }), { threshold: .12 }); $$('.reveal').forEach((el) => observer.observe(el));
  $$('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(backdrop.id); }));
}

document.addEventListener('DOMContentLoaded', init);
