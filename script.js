/* NetWise — Frontend Logic (Vanilla JavaScript)
   Created by Jana & Sara */

const APP_ICONS = {
  YouTube: "▶️", TikTok: "🎵", Instagram: "📸", Netflix: "🎬",
  WhatsApp: "💬", Facebook: "👥", Spotify: "🎧",
  "Google Chrome": "🌐", Snapchat: "👻", Zoom: "🎥", Gmail: "✉️",
};
const appIcon = (n) => APP_ICONS[n] || "📱";

// ===== الحالة =====
const state = {
  profile: null,
  apps: [],
  summary: "",
  source: null,
  alerts: [],
  editing: false,
};

let countdownTimer = null;

// ===== أدوات مساعدة =====
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 1) => Number(n).toFixed(d);

async function api(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "حدث خطأ");
  return data;
}

// ===== إعداد البيانات =====
$("setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("f-name").value.trim();
  const phone = $("f-phone").value.trim();
  const monthlyGb = Number($("f-monthly").value);
  const usedGb = Number($("f-used").value);
  const remainingDays = Number($("f-days").value);
  const errEl = $("setup-error");

  if (!name || !phone) return showError(errEl, "من فضلك أدخل الاسم ورقم التليفون.");
  if (monthlyGb <= 0 || usedGb < 0 || remainingDays <= 0)
    return showError(errEl, "أدخل قيم الجيجا والأيام بشكل صحيح.");
  if (usedGb > monthlyGb) return showError(errEl, "المستهلك لا يمكن أن يتجاوز إجمالي الباقة.");

  errEl.hidden = true;
  const btn = $("setup-submit");
  btn.disabled = true;
  btn.textContent = "جارٍ التحليل بواسطة Gemini…";

  try {
    const data = await api("/api/profile", {
      name, phone, monthlyGb, usedGb, remainingDays,
      plan: state.profile ? state.profile.plan : "free",
    });
    state.profile = data.profile;
    state.apps = data.apps;
    state.summary = data.analysis ? data.analysis.summary : "";
    state.source = data.analysis ? data.analysis.source : null;
    state.alerts = [{
      type: "info",
      message: `تم حساب حدك اليومي: ${data.profile.dailyLimit} جيجا/يوم لتكفيك الباقة حتى نهاية الشهر.`,
    }];
    state.editing = false;
    render();
  } catch (err) {
    showError(errEl, err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "احسب حدّي اليومي وحلّل استهلاكي";
  }
});

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

// ===== الأزرار العامة =====
$("back-to-dash").addEventListener("click", () => { state.editing = false; render(); });
$("edit-btn").addEventListener("click", () => { state.editing = true; render(); });

// إجراءات تعتمد على وجود ملف
function pid() { return state.profile ? state.profile.id : null; }

async function doAction(url, body, prependAlertOnError = true) {
  if (!pid()) return;
  try {
    const data = await api(url, body);
    if (data.profile) state.profile = data.profile;
    if (Array.isArray(data.newAlerts) && data.newAlerts.length) {
      state.alerts = [...data.newAlerts, ...state.alerts];
    }
    render();
  } catch (err) {
    if (prependAlertOnError) {
      state.alerts = [{ type: "info", message: err.message }, ...state.alerts];
      render();
    }
  }
}

// أزرار الاستهلاك السريع
document.querySelectorAll("#quick-usage .chip").forEach((b) => {
  b.addEventListener("click", () => doAction("/api/usage", { profileId: pid(), addGb: Number(b.dataset.gb) }));
});
$("custom-usage-btn").addEventListener("click", () => {
  const g = Number($("custom-gb").value);
  if (g > 0) doAction("/api/usage", { profileId: pid(), addGb: g });
});
$("reset-day").addEventListener("click", () => doAction("/api/settings", { profileId: pid(), action: "resetDay" }));
$("emergency-unblock").addEventListener("click", () => doAction("/api/settings", { profileId: pid(), action: "unblock" }));
$("blocking-toggle").addEventListener("click", () => {
  const enabled = !state.profile.blockingEnabled;
  doAction("/api/settings", { profileId: pid(), action: "toggleBlocking", enabled });
});
$("upgrade-btn").addEventListener("click", () => doAction("/api/settings", { profileId: pid(), action: "upgradePlan" }));
$("downgrade-btn").addEventListener("click", () => doAction("/api/settings", { profileId: pid(), action: "downgradePlan" }));

// ===== حساب العدّاد التنازلي للحظر =====
function blockRemainingMs() {
  const p = state.profile;
  if (!p || !p.blockingEnabled || !p.blockedUntil) return 0;
  const diff = new Date(p.blockedUntil).getTime() - Date.now();
  return diff > 0 ? diff : 0;
}
function fmtCountdown(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ===== العرض =====
function render() {
  const hasProfile = !!state.profile;
  $("setup-view").hidden = hasProfile && !state.editing;
  $("dashboard-view").hidden = !hasProfile || state.editing;
  $("back-to-dash").hidden = !(hasProfile && state.editing);

  // ملء الفورم عند التعديل
  if (state.editing && state.profile) {
    $("f-name").value = state.profile.name;
    $("f-phone").value = state.profile.phone;
    $("f-monthly").value = state.profile.monthlyGb;
    $("f-used").value = state.profile.usedGb;
    $("f-days").value = state.profile.remainingDays;
  }

  if (!hasProfile || state.editing) { stopCountdown(); return; }
  renderDashboard();
}

function renderDashboard() {
  const p = state.profile;

  $("d-name").textContent = p.name;
  $("d-phone").textContent = `(${p.phone})`;

  const planBadge = $("d-plan-badge");
  planBadge.textContent = p.plan === "paid" ? "الخطة المدفوعة ✨" : "الخطة المجانية";
  planBadge.className = "badge" + (p.plan === "paid" ? " badge-paid" : "");

  const remainingGb = Math.max(0, p.monthlyGb - p.usedGb);
  $("s-monthly").textContent = fmt(p.monthlyGb);
  $("s-remaining").textContent = fmt(remainingGb);
  $("s-days").textContent = p.remainingDays;
  $("s-limit").textContent = fmt(p.dailyLimit, 2);

  const todayPct = Math.min(100, (p.todayUsage / Math.max(p.dailyLimit, 0.01)) * 100);
  const monthPct = Math.min(100, (p.usedGb / Math.max(p.monthlyGb, 0.01)) * 100);
  const overLimit = p.todayUsage >= p.dailyLimit;
  const isBlocked = blockRemainingMs() > 0;

  $("today-label").textContent = `${fmt(p.todayUsage, 2)} / ${fmt(p.dailyLimit, 2)} جيجا اليوم`;
  $("today-pct").textContent = `${todayPct.toFixed(0)}%`;
  const todayBar = $("today-bar");
  todayBar.style.width = todayPct + "%";
  todayBar.classList.toggle("bar-over", overLimit);

  $("month-label").textContent = `إجمالي الشهر: ${fmt(p.usedGb)} / ${fmt(p.monthlyGb)} جيجا`;
  $("month-pct").textContent = `${monthPct.toFixed(0)}%`;
  $("month-bar").style.width = monthPct + "%";

  // حالة
  const sb = $("status-badge");
  if (isBlocked) { sb.textContent = "🔒 محظور"; sb.className = "badge badge-block"; }
  else if (overLimit) { sb.textContent = "⚠️ تجاوزت الحد اليومي"; sb.className = "badge badge-warn"; }
  else { sb.textContent = "✅ ضمن الحد"; sb.className = "badge badge-ok"; }

  // لوحة الحظر
  $("block-panel").hidden = !isBlocked;

  // تعطيل أزرار الاستهلاك عند الحظر
  document.querySelectorAll("#quick-usage .chip").forEach((b) => (b.disabled = isBlocked));
  $("custom-usage-btn").disabled = isBlocked;

  // التنبيهات
  renderAlerts();

  // التحليل
  const srcBadge = $("source-badge");
  srcBadge.textContent = state.source === "gemini" ? "🤖 تحليل Gemini AI" : "🤖 تحليل تقديري ذكي";
  srcBadge.className = "badge" + (state.source === "gemini" ? " badge-ok" : "");
  $("analysis-summary").textContent = state.summary;
  $("analysis-summary").hidden = !state.summary;
  renderApps();

  // الإعدادات
  const toggle = $("blocking-toggle");
  toggle.setAttribute("aria-pressed", String(p.blockingEnabled));
  $("emergency-note").hidden = p.blockingEnabled;

  // الخطط
  $("upgrade-btn").hidden = p.plan === "paid";
  $("subscribed-note").hidden = p.plan !== "paid";
  $("downgrade-btn").hidden = p.plan !== "paid";

  // العدّاد
  manageCountdown();
}

function renderAlerts() {
  const list = $("alerts-list");
  if (!state.alerts.length) {
    list.innerHTML = '<p class="muted small">لا توجد تنبيهات بعد. استمر في المتابعة وسيصلك تنبيه عند الاقتراب من الحد اليومي.</p>';
    return;
  }
  list.innerHTML = state.alerts.map((a) => {
    const cls = a.type === "block" ? "alert-block" : a.type === "warning" ? "alert-warning" : "alert-info";
    const icon = a.type === "block" ? "🔒" : a.type === "warning" ? "⚠️" : "ℹ️";
    return `<div class="alert ${cls} pop"><span class="icon">${icon}</span>${escapeHtml(a.message)}</div>`;
  }).join("");
}

function renderApps() {
  const grid = $("apps-grid");
  const maxGb = Math.max(0.01, ...state.apps.map((a) => a.estimatedGb));
  grid.innerHTML = state.apps.map((a) => `
    <div class="app-item">
      <div class="app-head">
        <div class="app-left">
          <span class="app-icon">${appIcon(a.appName)}</span>
          <div>
            <p class="app-name">${escapeHtml(a.appName)}</p>
            <p class="app-cat">${escapeHtml(a.category)}</p>
          </div>
        </div>
        <div>
          <p class="app-gb">${fmt(a.estimatedGb, 2)} جيجا</p>
          <p class="app-pct">${a.percentage}%</p>
        </div>
      </div>
      <div class="app-track"><div class="app-bar" style="width:${(a.estimatedGb / maxGb) * 100}%"></div></div>
      <p class="app-detail">${escapeHtml(a.detail)}</p>
      <p class="app-tip">💡 ${escapeHtml(a.tip)}</p>
    </div>`).join("");
}

// ===== العدّاد التنازلي =====
function manageCountdown() {
  stopCountdown();
  if (blockRemainingMs() <= 0) return;
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
}
function updateCountdown() {
  const ms = blockRemainingMs();
  if (ms <= 0) { stopCountdown(); renderDashboard(); return; }
  $("block-countdown").textContent = fmtCountdown(ms);
  const sb = $("status-badge");
  sb.textContent = "🔒 محظور — " + fmtCountdown(ms);
}
function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// بدء
render();
