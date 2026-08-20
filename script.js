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

// دالة بديلة للـ API تعمل محلياً بدون إرسال طلبات خارجية
async function api(url, body) {
  // محاكاة تأجير بسيط للشبكة
  await new Promise(resolve => setTimeout(resolve, 400));

  if (url === "/api/profile") {
    const dailyLimit = Number((body.monthlyGb / 30).toFixed(2));
    return {
      profile: {
        id: "local-user-1",
        name: body.name,
        phone: body.phone,
        monthlyGb: body.monthlyGb,
        usedGb: body.usedGb,
        remainingDays: body.remainingDays,
        dailyLimit: dailyLimit > 0 ? dailyLimit : 1.5,
        todayUsage: 0.5,
        blockingEnabled: true,
        blockedUntil: null,
        plan: body.plan || "free"
      },
      apps: [
        { appName: "YouTube", category: "فيديو ترفيهي", estimatedGb: body.usedGb * 0.4, percentage: 40, detail: "استهلاك مرتفع بسبب دقة الفيديو العالية.", tip: "جرب تقليل جودة الفيديو إلى 480p لتوفير الباقة." },
        { appName: "TikTok", category: "وسائط اجتماعية", estimatedGb: body.usedGb * 0.3, percentage: 30, detail: "مشاهدة المقاطع القصيرة تستهلك البيانات بسرعة.", tip: "فعل وضع توفير البيانات داخل التطبيق." },
        { appName: "Google Chrome", category: "تصفح ويب", estimatedGb: body.usedGb * 0.3, percentage: 30, detail: "تصفح المواقع وتحميل الملفات.", tip: "أغلق علامات التبويب غير المستخدمة." }
      ],
      analysis: {
        summary: "تم تحليل استهلاكك محلياً بنجاح بناءً على المعطيات المدخلة.",
        source: "estimated"
      }
    };
  }

  if (url === "/api/usage") {
    if (state.profile) {
      state.profile.usedGb = Number((state.profile.usedGb + body.addGb).toFixed(2));
      state.profile.todayUsage = Number((state.profile.todayUsage + body.addGb).toFixed(2));
    }
    return { profile: state.profile, newAlerts: [{ type: "warning", message: `تمت إضافة ${body.addGb} جيجا إلى استهلاكك بنجاح.` }] };
  }

  if (url === "/api/settings") {
    if (state.profile) {
      if (body.action === "resetDay") state.profile.todayUsage = 0;
      if (body.action === "unblock") state.profile.blockedUntil = null;
      if (body.action === "toggleBlocking") state.profile.blockingEnabled = body.enabled;
      if (body.action === "upgradePlan") state.profile.plan = "paid";
      if (body.action === "downgradePlan") state.profile.plan = "free";
    }
    return { profile: state.profile };
  }

  return { success: true };
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
  btn.textContent = "جارٍ المعالجة المحلية…";

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

  const sb = $("status-badge");
  if (isBlocked) { sb.textContent = "🔒 محظور"; sb.className = "badge badge-block"; }
  else if (overLimit) { sb.textContent = "⚠️ تجاوزت الحد اليومي"; sb.className = "badge badge-warn"; }
  else { sb.textContent = "✅ ضمن الحد"; sb.className = "badge badge-ok"; }

  $("block-panel").hidden = !isBlocked;

  document.querySelectorAll("#quick-usage .chip").forEach((b) => (b.disabled = isBlocked));
  $("custom-usage-btn").disabled = isBlocked;

  renderAlerts();

  const srcBadge = $("source-badge");
  srcBadge.textContent = "🤖 تحليل ذكي محلي";
  srcBadge.className = "badge badge-ok";
  $("analysis-summary").textContent = state.summary;
  $("analysis-summary").hidden = !state.summary;
  renderApps();

  const toggle = $("blocking-toggle");
  toggle.setAttribute("aria-pressed", String(p.blockingEnabled));
  $("emergency-note").hidden = p.blockingEnabled;

  $("upgrade-btn").hidden = p.plan === "paid";
  $("subscribed-note").hidden = p.plan !== "paid";
  $("downgrade-btn").hidden = p.plan !== "paid";

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

render();
