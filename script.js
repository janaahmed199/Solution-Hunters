/* =========================================================
   NetWise — Frontend Logic
   Vanilla JavaScript — No API / No Backend
   Created by Jana & Sara
   ========================================================= */


/* =========================
   APP ICONS
========================= */

const APP_ICONS = {
  YouTube: "▶️",
  TikTok: "🎵",
  Instagram: "📸",
  Netflix: "🎬",
  WhatsApp: "💬",
  Facebook: "👥",
  Spotify: "🎧",
  "Google Chrome": "🌐",
  Snapchat: "👻",
  Zoom: "🎥",
  Gmail: "✉️",
};

const appIcon = (name) => APP_ICONS[name] || "📱";


/* =========================
   STATE
========================= */

const state = {
  profile: null,
  apps: [],
  summary: "",
  source: "local",
  alerts: [],
  editing: false,
};


/* =========================
   COUNTDOWN
========================= */

let countdownTimer = null;


/* =========================
   HELPERS
========================= */

const $ = (id) => document.getElementById(id);

const fmt = (number, decimals = 1) => {
  return Number(number || 0).toFixed(decimals);
};


/* =========================
   LOCAL STORAGE
========================= */

function saveState() {
  localStorage.setItem(
    "netwise_state",
    JSON.stringify({
      profile: state.profile,
      apps: state.apps,
      summary: state.summary,
      source: state.source,
      alerts: state.alerts,
    })
  );
}


function loadState() {
  try {
    const saved = localStorage.getItem("netwise_state");

    if (!saved) return;

    const data = JSON.parse(saved);

    state.profile = data.profile || null;
    state.apps = Array.isArray(data.apps) ? data.apps : [];
    state.summary = data.summary || "";
    state.source = data.source || "local";
    state.alerts = Array.isArray(data.alerts) ? data.alerts : [];

  } catch (error) {
    console.error("Could not load saved data:", error);
  }
}


/* =========================
   ESCAPE HTML
========================= */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


/* =========================
   CREATE APP ANALYSIS
========================= */

function generateAppsAnalysis(profile) {

  const remaining = Math.max(
    0,
    profile.monthlyGb - profile.usedGb
  );

  /*
    تقدير استهلاك التطبيقات.
    النسب مجرد Simulation للـ Demo
    وليست قراءة حقيقية من الهاتف.
  */

  const apps = [
    {
      appName: "YouTube",
      category: "فيديو",
      percentage: 25,
      detail: "استهلاك مرتفع نسبيًا بسبب مشاهدة الفيديوهات.",
      tip: "قلل جودة الفيديو إلى 480p أو 720p لتوفير البيانات.",
    },

    {
      appName: "TikTok",
      category: "فيديو قصير",
      percentage: 18,
      detail: "الفيديوهات القصيرة قد تستهلك البيانات بسرعة.",
      tip: "استخدم Wi-Fi عند مشاهدة الفيديو لفترات طويلة.",
    },

    {
      appName: "Instagram",
      category: "Social Media",
      percentage: 14,
      detail: "الصور والفيديوهات والـ Reels تستهلك جزءًا من الباقة.",
      tip: "قلل مشاهدة الـ Reels أثناء استخدام بيانات الهاتف.",
    },

    {
      appName: "Netflix",
      category: "Streaming",
      percentage: 12,
      detail: "مشاهدة الفيديو بجودة عالية تستهلك بيانات كثيرة.",
      tip: "استخدم جودة منخفضة عند استخدام بيانات الهاتف.",
    },

    {
      appName: "WhatsApp",
      category: "Messaging",
      percentage: 8,
      detail: "الاستهلاك يأتي غالبًا من الصور والفيديوهات.",
      tip: "أوقف التحميل التلقائي للفيديوهات الكبيرة.",
    },

    {
      appName: "Spotify",
      category: "Music",
      percentage: 7,
      detail: "الاستماع للموسيقى يستهلك بيانات أقل من الفيديو.",
      tip: "قم بتحميل الأغاني مسبقًا باستخدام Wi-Fi.",
    },

    {
      appName: "Facebook",
      category: "Social Media",
      percentage: 6,
      detail: "الفيديوهات والصور تمثل الجزء الأكبر من الاستهلاك.",
      tip: "فعّل Data Saver داخل التطبيق.",
    },

    {
      appName: "Google Chrome",
      category: "Browsing",
      percentage: 5,
      detail: "التصفح يعتمد على حجم الصور والفيديوهات الموجودة بالمواقع.",
      tip: "تجنب تحميل الملفات الكبيرة باستخدام بيانات الهاتف.",
    },

    {
      appName: "Snapchat",
      category: "Social Media",
      percentage: 3,
      detail: "القصص والفلاتر قد تستهلك كمية إضافية من البيانات.",
      tip: "قلل استخدام الفيديو أثناء استخدام بيانات الهاتف.",
    },

    {
      appName: "Zoom",
      category: "Video Calls",
      percentage: 2,
      detail: "مكالمات الفيديو يمكن أن تستهلك بيانات بسرعة.",
      tip: "استخدم Wi-Fi أثناء الاجتماعات الطويلة.",
    },
  ];

  /*
    نستخدم نسبة من الاستهلاك الحالي
    لإظهار تقدير منطقي في الـ Demo.
  */

  const estimatedTotal = Math.max(
    0.5,
    profile.usedGb * 0.75
  );

  return apps.map((app) => {

    const estimatedGb =
      estimatedTotal * (app.percentage / 100);

    return {
      ...app,
      estimatedGb: Number(estimatedGb.toFixed(2)),
    };

  });
}


/* =========================
   GENERATE SUMMARY
========================= */

function generateSummary(profile) {

  const remaining =
    Math.max(0, profile.monthlyGb - profile.usedGb);

  const dailyLimit =
    profile.remainingDays > 0
      ? remaining / profile.remainingDays
      : 0;

  let message = "";

  if (profile.usedGb >= profile.monthlyGb * 0.8) {

    message =
      `استهلاكك وصل إلى ${Math.round(
        (profile.usedGb / profile.monthlyGb) * 100
      )}% من الباقة. حاول تقليل استهلاك الفيديو للحفاظ على الجيجا المتبقية.`;

  } else if (dailyLimit < 1) {

    message =
      `المتبقي ${fmt(
        remaining,
        2
      )} جيجا لـ ${profile.remainingDays} يوم. حاول الالتزام بحد يومي منخفض لتجنب انتهاء الباقة مبكرًا.`;

  } else {

    message =
      `لديك ${fmt(
        remaining,
        2
      )} جيجا متبقية، ويمكنك استخدام حوالي ${fmt(
        dailyLimit,
        2
      )} جيجا يوميًا حتى نهاية الفترة.`;
  }

  return message;
}


/* =========================
   CALCULATE DAILY LIMIT
========================= */

function calculateDailyLimit(monthlyGb, usedGb, days) {

  const remaining =
    Math.max(0, monthlyGb - usedGb);

  if (days <= 0) return 0;

  return remaining / days;
}


/* =========================
   CREATE ALERT
========================= */

function addAlert(type, message) {

  state.alerts.unshift({
    type,
    message,
    time: new Date().toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  /*
    نخلي آخر 10 تنبيهات فقط
  */

  state.alerts = state.alerts.slice(0, 10);

  saveState();
}


/* =========================
   SETUP FORM
========================= */

$("setup-form").addEventListener("submit", (event) => {

  event.preventDefault();

  const name =
    $("f-name").value.trim();

  const phone =
    $("f-phone").value.trim();

  const monthlyGb =
    Number($("f-monthly").value);

  const usedGb =
    Number($("f-used").value);

  const remainingDays =
    Number($("f-days").value);

  const errorBox =
    $("setup-error");


  /* Validation */

  if (!name || !phone) {

    showError(
      errorBox,
      "من فضلك أدخل الاسم ورقم التليفون."
    );

    return;
  }


  if (
    monthlyGb <= 0 ||
    usedGb < 0 ||
    remainingDays <= 0
  ) {

    showError(
      errorBox,
      "أدخل قيم الباقة والاستهلاك والأيام بشكل صحيح."
    );

    return;
  }


  if (usedGb > monthlyGb) {

    showError(
      errorBox,
      "المستهلك لا يمكن أن يتجاوز إجمالي الباقة."
    );

    return;
  }


  errorBox.hidden = true;


  /* Calculate */

  const remainingGb =
    monthlyGb - usedGb;

  const dailyLimit =
    calculateDailyLimit(
      monthlyGb,
      usedGb,
      remainingDays
    );


  /* Create profile */

  state.profile = {

    id:
      state.profile?.id ||
      "profile-" + Date.now(),

    name,
    phone,

    monthlyGb,
    usedGb,

    remainingDays,

    dailyLimit:
      Number(dailyLimit.toFixed(2)),

    todayUsage:
      state.profile?.todayUsage || 0,

    blockingEnabled:
      state.profile?.blockingEnabled !== false,

    blockedUntil:
      null,

    plan:
      state.profile?.plan || "free",
  };


  /* Generate local analysis */

  state.apps =
    generateAppsAnalysis(
      state.profile
    );

  state.summary =
    generateSummary(
      state.profile
    );

  state.source =
    "local";


  /* Alert */

  state.alerts = [];

  addAlert(
    "info",
    `تم حساب حدك اليومي: ${fmt(
      state.profile.dailyLimit,
      2
    )} جيجا/يوم.`
  );


  state.editing = false;


  saveState();

  render();
});


/* =========================
   ERROR
========================= */

function showError(element, message) {

  element.textContent = message;

  element.hidden = false;
}


/* =========================
   BACK BUTTON
========================= */

$("back-to-dash").addEventListener(
  "click",
  () => {

    state.editing = false;

    render();
  }
);


/* =========================
   EDIT BUTTON
========================= */

$("edit-btn").addEventListener(
  "click",
  () => {

    state.editing = true;

    render();
  }
);


/* =========================
   ADD USAGE
========================= */

function addUsage(amount) {

  if (!state.profile) return;

  const profile =
    state.profile;


  /* If internet is blocked */

  if (blockRemainingMs() > 0) {

    addAlert(
      "block",
      "الإنترنت محظور مؤقتًا. يمكنك إلغاء الحظر من زر الطوارئ."
    );

    render();

    return;
  }


  amount =
    Number(amount);


  if (!amount || amount <= 0)
    return;


  /*
    Update usage
  */

  profile.todayUsage += amount;

  profile.usedGb += amount;


  /*
    Don't exceed package
  */

  profile.usedGb =
    Math.min(
      profile.usedGb,
      profile.monthlyGb
    );


  /*
    Recalculate remaining
  */

  const remaining =
    Math.max(
      0,
      profile.monthlyGb -
      profile.usedGb
    );


  /*
    Recalculate daily limit
  */

  profile.dailyLimit =
    profile.remainingDays > 0
      ? Number(
          (
            remaining /
            profile.remainingDays
          ).toFixed(2)
        )
      : 0;


  /*
    Alerts
  */

  if (
    profile.todayUsage >=
    profile.dailyLimit
  ) {

    addAlert(
      "warning",
      `⚠️ تجاوزت الحد اليومي. استهلاك اليوم ${fmt(
        profile.todayUsage,
        2
      )} جيجا.`
    );


    /*
      إذا كان الحظر مفعّلًا
    */

    if (profile.blockingEnabled) {

      /*
        حظر لمدة ساعة
      */

      const blockedUntil =
        Date.now() +
        60 * 60 * 1000;

      profile.blockedUntil =
        new Date(
          blockedUntil
        ).toISOString();


      addAlert(
        "block",
        "🔒 تم حظر الإنترنت لمدة ساعة لحماية الباقة."
      );
    }

  } else if (
    profile.todayUsage >=
    profile.dailyLimit * 0.8
  ) {

    addAlert(
      "warning",
      "⚠️ اقتربت من الحد اليومي. حاول تقليل الاستهلاك."
    );
  }


  /*
    Update analysis
  */

  state.apps =
    generateAppsAnalysis(
      profile
    );

  state.summary =
    generateSummary(
      profile
    );


  saveState();

  render();
}


/* =========================
   QUICK USAGE BUTTONS
========================= */

document
  .querySelectorAll(
    "#quick-usage .chip"
  )
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        const amount =
          Number(
            button.dataset.gb
          );

        addUsage(amount);
      }
    );

  });


/* =========================
   CUSTOM USAGE
========================= */

$("custom-usage-btn")
  .addEventListener(
    "click",
    () => {

      const amount =
        Number(
          $("custom-gb").value
        );

      if (amount <= 0) return;

      addUsage(amount);
    }
  );


/* =========================
   NEW DAY
========================= */

$("reset-day")
  .addEventListener(
    "click",
    () => {

      if (!state.profile)
        return;


      state.profile.todayUsage =
        0;


      state.profile.blockedUntil =
        null;


      addAlert(
        "info",
        "🔄 تم بدء يوم جديد وتم تصفير استهلاك اليوم."
      );


      saveState();

      render();
    }
  );


/* =========================
   EMERGENCY UNBLOCK
========================= */

$("emergency-unblock")
  .addEventListener(
    "click",
    () => {

      if (!state.profile)
        return;


      state.profile.blockedUntil =
        null;


      addAlert(
        "info",
        "🚨 تم إلغاء الحظر في وضع الطوارئ."
      );


      saveState();

      render();
    }
  );


/* =========================
   BLOCKING TOGGLE
========================= */

$("blocking-toggle")
  .addEventListener(
    "click",
    () => {

      if (!state.profile)
        return;


      state.profile.blockingEnabled =
        !state.profile.blockingEnabled;


      if (
        !state.profile.blockingEnabled
      ) {

        state.profile.blockedUntil =
          null;


        addAlert(
          "info",
          "تم تعطيل الحظر التلقائي."
        );

      } else {

        addAlert(
          "info",
          "تم تفعيل الحظر التلقائي."
        );
      }


      saveState();

      render();
    }
  );


/* =========================
   UPGRADE PLAN
========================= */

$("upgrade-btn")
  .addEventListener(
    "click",
    () => {

      if (!state.profile)
        return;


      state.profile.plan =
        "paid";


      addAlert(
        "info",
        "✨ تم تفعيل الخطة المدفوعة في النسخة التجريبية."
      );


      saveState();

      render();
    }
  );


/* =========================
   DOWNGRADE PLAN
========================= */

$("downgrade-btn")
  .addEventListener(
    "click",
    () => {

      if (!state.profile)
        return;


      state.profile.plan =
        "free";


      addAlert(
        "info",
        "تم الرجوع للخطة المجانية."
      );


      saveState();

      render();
    }
  );


/* =========================
   BLOCK COUNTDOWN
========================= */

function blockRemainingMs() {

  const profile =
    state.profile;


  if (
    !profile ||
    !profile.blockedUntil
  ) {

    return 0;
  }


  const difference =
    new Date(
      profile.blockedUntil
    ).getTime() -
    Date.now();


  return difference > 0
    ? difference
    : 0;
}


/* =========================
   FORMAT COUNTDOWN
========================= */

function fmtCountdown(ms) {

  const minutes =
    Math.floor(
      ms / 60000
    );

  const seconds =
    Math.floor(
      (ms % 60000) / 1000
    );


  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0")
  );
}


/* =========================
   RENDER
========================= */

function render() {

  const hasProfile =
    !!state.profile;


  /*
    Show / hide views
  */

  $("setup-view").hidden =
    hasProfile &&
    !state.editing;


  $("dashboard-view").hidden =
    !hasProfile ||
    state.editing;


  $("back-to-dash").hidden =
    !(hasProfile &&
      state.editing);


  /*
    Fill form while editing
  */

  if (
    state.editing &&
    state.profile
  ) {

    $("f-name").value =
      state.profile.name;

    $("f-phone").value =
      state.profile.phone;

    $("f-monthly").value =
      state.profile.monthlyGb;

    $("f-used").value =
      state.profile.usedGb;

    $("f-days").value =
      state.profile.remainingDays;
  }


  if (
    !hasProfile ||
    state.editing
  ) {

    stopCountdown();

    return;
  }


  renderDashboard();
}


/* =========================
   DASHBOARD
========================= */

function renderDashboard() {

  const profile =
    state.profile;


  /*
    Welcome
  */

  $("d-name").textContent =
    profile.name;


  $("d-phone").textContent =
    `(${profile.phone})`;


  /*
    Plan
  */

  const planBadge =
    $("d-plan-badge");


  if (
    profile.plan === "paid"
  ) {

    planBadge.textContent =
      "الخطة المدفوعة ✨";

    planBadge.className =
      "badge badge-paid";

  } else {

    planBadge.textContent =
      "الخطة المجانية";

    planBadge.className =
      "badge";
  }


  /*
    Package
  */

  const remainingGb =
    Math.max(
      0,
      profile.monthlyGb -
      profile.usedGb
    );


  $("s-monthly").textContent =
    fmt(profile.monthlyGb);


  $("s-remaining").textContent =
    fmt(remainingGb);


  $("s-days").textContent =
    profile.remainingDays;


  $("s-limit").textContent =
    fmt(
      profile.dailyLimit,
      2
    );


  /*
    Today's percentage
  */

  const todayPercentage =
    profile.dailyLimit > 0
      ? (
          profile.todayUsage /
          profile.dailyLimit
        ) * 100
      : 0;


  const todayPct =
    Math.min(
      100,
      todayPercentage
    );


  /*
    Month percentage
  */

  const monthPercentage =
    profile.monthlyGb > 0
      ? (
          profile.usedGb /
          profile.monthlyGb
        ) * 100
      : 0;


  const monthPct =
    Math.min(
      100,
      monthPercentage
    );


  /*
    Over limit
  */

  const overLimit =
    profile.todayUsage >=
    profile.dailyLimit;


  const isBlocked =
    blockRemainingMs() > 0;


  /*
    Today's label
  */

  $("today-label").textContent =
    `${fmt(
      profile.todayUsage,
      2
    )} / ${fmt(
      profile.dailyLimit,
      2
    )} جيجا اليوم`;


  $("today-pct").textContent =
    `${todayPct.toFixed(0)}%`;


  /*
    Today's progress
  */

  const todayBar =
    $("today-bar");


  todayBar.style.width =
    todayPct + "%";


  todayBar.classList.toggle(
    "bar-over",
    overLimit
  );


  /*
    Month progress
  */

  $("month-label").textContent =
    `إجمالي الشهر: ${fmt(
      profile.usedGb,
      1
    )} / ${fmt(
      profile.monthlyGb,
      1
    )} جيجا`;


  $("month-pct").textContent =
    `${monthPct.toFixed(0)}%`;


  $("month-bar").style.width =
    monthPct + "%";


  /*
    Status
  */

  const statusBadge =
    $("status-badge");


  if (isBlocked) {

    statusBadge.textContent =
      "🔒 محظور";

    statusBadge.className =
      "badge badge-block";

  } else if (overLimit) {

    statusBadge.textContent =
      "⚠️ تجاوزت الحد اليومي";

    statusBadge.className =
      "badge badge-warn";

  } else {

    statusBadge.textContent =
      "✅ ضمن الحد";

    statusBadge.className =
      "badge badge-ok";
  }


  /*
    Block panel
  */

  $("block-panel").hidden =
    !isBlocked;


  /*
    Disable usage buttons
  */

  document
    .querySelectorAll(
      "#quick-usage .chip"
    )
    .forEach(
      (button) => {

        button.disabled =
          isBlocked;
      }
    );


  $("custom-usage-btn").disabled =
    isBlocked;


  /*
    Alerts
  */

  renderAlerts();


  /*
    Analysis
  */

  const sourceBadge =
    $("source-badge");


  sourceBadge.textContent =
    "📊 تحليل تقديري ذكي";


  sourceBadge.className =
    "badge badge-ok";


  $("analysis-summary").textContent =
    state.summary;


  $("analysis-summary").hidden =
    !state.summary;


  renderApps();


  /*
    Settings
  */

  const toggle =
    $("blocking-toggle");


  toggle.setAttribute(
    "aria-pressed",
    String(
      profile.blockingEnabled
    )
  );


  $("emergency-note").hidden =
    profile.blockingEnabled;


  /*
    Plans
  */

  $("upgrade-btn").hidden =
    profile.plan === "paid";


  $("subscribed-note").hidden =
    profile.plan !== "paid";


  $("downgrade-btn").hidden =
    profile.plan !== "paid";


  /*
    Countdown
  */

  manageCountdown();
}


/* =========================
   ALERTS
========================= */

function renderAlerts() {

  const list =
    $("alerts-list");


  if (!state.alerts.length) {

    list.innerHTML =
      `<p class="muted small">
        لا توجد تنبيهات بعد.
        استمر في المتابعة وسيصلك تنبيه عند الاقتراب من الحد اليومي.
      </p>`;

    return;
  }


  list.innerHTML =
    state.alerts
      .map((alert) => {

        let className =
          "alert-info";

        let icon =
          "ℹ️";


        if (
          alert.type ===
          "warning"
        ) {

          className =
            "alert-warning";

          icon =
            "⚠️";
        }


        if (
          alert.type ===
          "block"
        ) {

          className =
            "alert-block";

          icon =
            "🔒";
        }


        return `
          <div class="alert ${className} pop">

            <span class="icon">
              ${icon}
            </span>

            <span>
              ${escapeHtml(
                alert.message
              )}
            </span>

          </div>
        `;

      })
      .join("");
}


/* =========================
   APPS
========================= */

function renderApps() {

  const grid =
    $("apps-grid");


  if (!state.apps.length) {

    grid.innerHTML =
      `<p class="muted">
        لا يوجد تحليل للتطبيقات حتى الآن.
      </p>`;

    return;
  }


  const maxGb =
    Math.max(
      0.01,
      ...state.apps.map(
        (app) =>
          Number(
            app.estimatedGb
          )
      )
    );


  grid.innerHTML =
    state.apps
      .map((app) => {

        const width =
          (
            app.estimatedGb /
            maxGb
          ) * 100;


        return `
          <div class="app-item">

            <div class="app-head">

              <div class="app-left">

                <span class="app-icon">
                  ${appIcon(
                    app.appName
                  )}
                </span>

                <div>

                  <p class="app-name">
                    ${escapeHtml(
                      app.appName
                    )}
                  </p>

                  <p class="app-cat">
                    ${escapeHtml(
                      app.category
                    )}
                  </p>

                </div>

              </div>


              <div>

                <p class="app-gb">
                  ${fmt(
                    app.estimatedGb,
                    2
                  )} جيجا
                </p>

                <p class="app-pct">
                  ${app.percentage}%
                </p>

              </div>

            </div>


            <div class="app-track">

              <div
                class="app-bar"
                style="
                  width:${width}%;
                "
              ></div>

            </div>


            <p class="app-detail">
              ${escapeHtml(
                app.detail
              )}
            </p>


            <p class="app-tip">
              💡
              ${escapeHtml(
                app.tip
              )}
            </p>

          </div>
        `;

      })
      .join("");
}


/* =========================
   COUNTDOWN MANAGEMENT
========================= */

function manageCountdown() {

  stopCountdown();


  if (
    blockRemainingMs() <= 0
  ) {

    return;
  }


  updateCountdown();


  countdownTimer =
    setInterval(
      updateCountdown,
      1000
    );
}


/* =========================
   UPDATE COUNTDOWN
========================= */

function updateCountdown() {

  const remaining =
    blockRemainingMs();


  if (remaining <= 0) {

    if (state.profile) {

      state.profile.blockedUntil =
        null;

      saveState();
    }


    stopCountdown();

    renderDashboard();

    return;
  }


  $("block-countdown").textContent =
    fmtCountdown(
      remaining
    );


  const statusBadge =
    $("status-badge");


  statusBadge.textContent =
    "🔒 محظور — " +
    fmtCountdown(
      remaining
    );
}


/* =========================
   STOP COUNTDOWN
========================= */

function stopCountdown() {

  if (
    countdownTimer
  ) {

    clearInterval(
      countdownTimer
    );

    countdownTimer =
      null;
  }
}


/* =========================
   START APPLICATION
========================= */

loadState();

render();
