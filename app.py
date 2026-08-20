# -*- coding: utf-8 -*-
"""
NetWise — إدارة استهلاك الإنترنت بذكاء
Backend: Python + Flask
تحليل استهلاك التطبيقات عبر Gemini API (المفتاح يُقرأ من .env فقط)
Created by Jana & Sara
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta

import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# تحميل متغيرات البيئة (مفتاح Gemini) من ملف .env
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "netwise.db")

# الواجهة (index.html / style.css / script.js) في نفس المجلد
app = Flask(__name__, static_folder=None)
CORS(app)

HOUR = timedelta(hours=1)
MAX_WARNINGS = 2  # تنبيهان قبل الحظر


# =====================================================================
# بيانات افتراضية واقعية تحاكي استهلاك التطبيقات لدى مستخدم حقيقي
# =====================================================================
APP_TEMPLATES = [
    {
        "appName": "YouTube", "category": "فيديو", "weight": 26,
        "detail": "مشاهدة فيديو HD تستهلك ~1.5 جيجا/ساعة، أما 480p فتستهلك ~0.5 جيجا/ساعة.",
        "tip": "قلّل الجودة إلى 480p عند استخدام بيانات الهاتف لتوفير حتى 60%.",
    },
    {
        "appName": "TikTok", "category": "فيديو قصير", "weight": 19,
        "detail": "التمرير المستمر للفيديوهات يستهلك ~0.8 جيجا لكل ساعة تصفح.",
        "tip": "فعّل Data Saver داخل التطبيق لتقليل جودة التحميل التلقائي.",
    },
    {
        "appName": "Instagram", "category": "تواصل اجتماعي", "weight": 14,
        "detail": "الـ Reels والقصص تستهلك ~0.7 جيجا/ساعة، والصور ~0.1 جيجا/ساعة.",
        "tip": "أوقف التشغيل التلقائي للفيديو من إعدادات استخدام البيانات.",
    },
    {
        "appName": "Netflix", "category": "بث", "weight": 12,
        "detail": "الجودة العالية تستهلك ~3 جيجا/ساعة، والمتوسطة ~0.7 جيجا/ساعة.",
        "tip": "حمّل الحلقات على Wi-Fi للمشاهدة لاحقًا دون بيانات.",
    },
    {
        "appName": "WhatsApp", "category": "مراسلة", "weight": 8,
        "detail": "الرسالة النصية ~5 كيلوبايت، والمكالمة الصوتية ~0.3 ميجا/دقيقة، الفيديو ~4 ميجا/دقيقة.",
        "tip": "أوقف التنزيل التلقائي للوسائط عبر بيانات الهاتف.",
    },
    {
        "appName": "Facebook", "category": "تواصل اجتماعي", "weight": 7,
        "detail": "تصفح الخلاصة مع الفيديوهات يستهلك ~0.6 جيجا/ساعة.",
        "tip": "استخدم وضع توفير البيانات في تطبيق فيسبوك.",
    },
    {
        "appName": "Spotify", "category": "موسيقى", "weight": 4,
        "detail": "البث بجودة عالية ~0.15 جيجا/ساعة، والعادية ~0.07 جيجا/ساعة.",
        "tip": "حمّل قوائم التشغيل للاستماع دون اتصال.",
    },
    {
        "appName": "Google Chrome", "category": "تصفح", "weight": 4,
        "detail": "تصفح المواقع العادية ~0.06 جيجا/ساعة حسب المحتوى.",
        "tip": "فعّل Lite Mode لضغط الصفحات وتوفير البيانات.",
    },
    {
        "appName": "Snapchat", "category": "تواصل اجتماعي", "weight": 3,
        "detail": "الرسائل المصورة والقصص تستهلك ~0.4 جيجا/ساعة.",
        "tip": "أوقف خاصية Travel Mode لمنع التحميل المسبق.",
    },
    {
        "appName": "Zoom", "category": "مكالمات فيديو", "weight": 2,
        "detail": "مكالمة فيديو جماعية ~0.8 جيجا/ساعة، وفردية ~0.5 جيجا/ساعة.",
        "tip": "أطفئ الكاميرا عند عدم الحاجة لتقليل الاستهلاك للنصف.",
    },
    {
        "appName": "Gmail", "category": "بريد", "weight": 1,
        "detail": "استهلاك منخفض ~0.02 جيجا/يوم بدون مرفقات كبيرة.",
        "tip": "حمّل المرفقات الكبيرة عبر Wi-Fi فقط.",
    },
]


def distribute_usage(total_used_gb):
    """توزيع إجمالي الاستهلاك على التطبيقات حسب أوزان واقعية."""
    total = max(0.0, float(total_used_gb))
    weight_sum = sum(a["weight"] for a in APP_TEMPLATES)
    result = []
    for a in APP_TEMPLATES:
        gb = (a["weight"] / weight_sum) * total
        result.append({
            "appName": a["appName"],
            "category": a["category"],
            "estimatedGb": round(gb, 2),
            "percentage": round((a["weight"] / weight_sum) * 100, 1),
            "detail": a["detail"],
            "tip": a["tip"],
        })
    return result


# =====================================================================
# حساب الحد اليومي بحيث تكفي الباقة لآخر الشهر
# =====================================================================
def compute_daily_limit(monthly_gb, used_gb, remaining_days):
    remaining = max(0.0, float(monthly_gb) - float(used_gb))
    days = max(1, int(remaining_days))
    return round(remaining / days, 2)


# =====================================================================
# تحليل الاستهلاك عبر Gemini API (المفتاح من .env فقط)
# =====================================================================
def analyze_with_gemini(name, monthly_gb, used_gb, remaining_days):
    baseline = distribute_usage(used_gb)
    api_key = os.getenv("GEMINI_API_KEY")

    fallback_summary = (
        f"تم توزيع {used_gb:.1f} جيجا على تطبيقاتك بناءً على أنماط استخدام واقعية. "
        "أعلى استهلاك من تطبيقات الفيديو، ويُنصح بتفعيل وضع توفير البيانات فيها."
    )

    if not api_key:
        return {"summary": fallback_summary, "source": "fallback", "apps": baseline}

    apps_lines = "\n".join(
        f"- {a['appName']} ({a['category']}): {a['estimatedGb']} جيجا ({a['percentage']}%)"
        for a in baseline
    )
    prompt = f"""أنت محلل بيانات لتطبيق NetWise لإدارة استهلاك الإنترنت.
المستخدم: {name}
الباقة الشهرية: {monthly_gb} جيجا
المستهلك حتى الآن: {used_gb} جيجا
الأيام المتبقية: {remaining_days}

هذه بيانات افتراضية واقعية لتوزيع الاستهلاك على التطبيقات:
{apps_lines}

حلّل استهلاك كل تطبيق بدقة، وأعِد النتيجة بصيغة JSON فقط بدون أي نص إضافي بالشكل:
{{
  "summary": "ملخص تحليلي قصير بالعربية عن سلوك الاستهلاك ونصيحة عامة",
  "apps": [
    {{"appName": "...", "category": "...", "estimatedGb": 0.0, "percentage": 0.0, "detail": "معلومة دقيقة عن معدل استهلاك التطبيق", "tip": "نصيحة عملية لترشيد الاستهلاك"}}
  ]
}}
حافظ على نفس أسماء التطبيقات وقيم estimatedGb و percentage كما هي، وحسّن فقط summary و detail و tip."""

    try:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.0-flash:generateContent?key={api_key}"
        )
        resp = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json"},
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        cleaned = text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(cleaned)

        by_name = {p.get("appName"): p for p in parsed.get("apps", [])}
        merged = []
        for base in baseline:
            m = by_name.get(base["appName"], {})
            merged.append({
                "appName": base["appName"],
                "category": m.get("category", base["category"]),
                "estimatedGb": base["estimatedGb"],
                "percentage": base["percentage"],
                "detail": m.get("detail", base["detail"]),
                "tip": m.get("tip", base["tip"]),
            })
        return {
            "summary": parsed.get("summary", "تم تحليل الاستهلاك بواسطة Gemini بنجاح."),
            "source": "gemini",
            "apps": merged,
        }
    except Exception:
        return {"summary": fallback_summary, "source": "fallback", "apps": baseline}


# =====================================================================
# قاعدة البيانات (SQLite)
# =====================================================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            monthlyGb REAL NOT NULL DEFAULT 0,
            usedGb REAL NOT NULL DEFAULT 0,
            remainingDays INTEGER NOT NULL DEFAULT 30,
            dailyLimit REAL NOT NULL DEFAULT 0,
            todayUsage REAL NOT NULL DEFAULT 0,
            plan TEXT NOT NULL DEFAULT 'free',
            subscriptionStart TEXT,
            blockingEnabled INTEGER NOT NULL DEFAULT 1,
            warningCount INTEGER NOT NULL DEFAULT 0,
            blockedUntil TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profileId INTEGER NOT NULL,
            appName TEXT NOT NULL,
            category TEXT NOT NULL,
            estimatedGb REAL NOT NULL DEFAULT 0,
            percentage REAL NOT NULL DEFAULT 0,
            detail TEXT NOT NULL DEFAULT '',
            tip TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profileId INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            createdAt TEXT NOT NULL
        );
        """
    )
    conn.commit()
    conn.close()


def profile_to_dict(row):
    d = dict(row)
    d["blockingEnabled"] = bool(d["blockingEnabled"])
    return d


def now_iso():
    return datetime.utcnow().isoformat()


def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


# =====================================================================
# مسارات الواجهة (تقديم الملفات الثابتة)
# =====================================================================
@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/style.css")
def style():
    return send_from_directory(BASE_DIR, "style.css")


@app.route("/script.js")
def script():
    return send_from_directory(BASE_DIR, "script.js")


@app.route("/api/health")
def health():
    return jsonify({"ok": True})


# =====================================================================
# API: إنشاء / تحديث الملف + تحليل Gemini
# =====================================================================
@app.route("/api/profile", methods=["GET", "POST"])
def api_profile():
    conn = get_db()
    if request.method == "GET":
        phone = request.args.get("phone")
        if not phone:
            conn.close()
            return jsonify({"error": "phone is required"}), 400
        row = conn.execute("SELECT * FROM profiles WHERE phone=?", (phone,)).fetchone()
        if not row:
            conn.close()
            return jsonify({"error": "not found"}), 404
        apps = conn.execute("SELECT * FROM app_usage WHERE profileId=?", (row["id"],)).fetchall()
        conn.close()
        return jsonify({"profile": profile_to_dict(row), "apps": [dict(a) for a in apps]})

    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip()
    phone = str(body.get("phone", "")).strip()
    plan = "paid" if body.get("plan") == "paid" else "free"
    try:
        monthly_gb = float(body.get("monthlyGb"))
        used_gb = float(body.get("usedGb"))
        remaining_days = int(body.get("remainingDays"))
    except (TypeError, ValueError):
        conn.close()
        return jsonify({"error": "أدخل أرقامًا صحيحة للجيجا والأيام"}), 400

    if not name or not phone:
        conn.close()
        return jsonify({"error": "الاسم ورقم التليفون مطلوبان"}), 400
    if monthly_gb <= 0 or used_gb < 0 or remaining_days <= 0:
        conn.close()
        return jsonify({"error": "أدخل قيم الجيجا والأيام بشكل صحيح"}), 400

    daily_limit = compute_daily_limit(monthly_gb, used_gb, remaining_days)
    analysis = analyze_with_gemini(name, monthly_gb, used_gb, remaining_days)
    now = now_iso()

    existing = conn.execute("SELECT * FROM profiles WHERE phone=?", (phone,)).fetchone()
    if existing:
        sub_start = existing["subscriptionStart"]
        if plan == "paid" and not sub_start:
            sub_start = now
        conn.execute(
            """UPDATE profiles SET name=?, monthlyGb=?, usedGb=?, remainingDays=?,
               dailyLimit=?, plan=?, subscriptionStart=?, updatedAt=? WHERE id=?""",
            (name, monthly_gb, used_gb, remaining_days, daily_limit, plan,
             sub_start, now, existing["id"]),
        )
        profile_id = existing["id"]
    else:
        sub_start = now if plan == "paid" else None
        cur = conn.execute(
            """INSERT INTO profiles
               (name, phone, monthlyGb, usedGb, remainingDays, dailyLimit, todayUsage,
                plan, subscriptionStart, blockingEnabled, warningCount, blockedUntil,
                createdAt, updatedAt)
               VALUES (?,?,?,?,?,?,0,?,?,1,0,NULL,?,?)""",
            (name, phone, monthly_gb, used_gb, remaining_days, daily_limit,
             plan, sub_start, now, now),
        )
        profile_id = cur.lastrowid

    conn.execute("DELETE FROM app_usage WHERE profileId=?", (profile_id,))
    for a in analysis["apps"]:
        conn.execute(
            """INSERT INTO app_usage
               (profileId, appName, category, estimatedGb, percentage, detail, tip)
               VALUES (?,?,?,?,?,?,?)""",
            (profile_id, a["appName"], a["category"], a["estimatedGb"],
             a["percentage"], a["detail"], a["tip"]),
        )
    conn.commit()

    row = conn.execute("SELECT * FROM profiles WHERE id=?", (profile_id,)).fetchone()
    apps = conn.execute("SELECT * FROM app_usage WHERE profileId=?", (profile_id,)).fetchall()
    conn.close()
    return jsonify({
        "profile": profile_to_dict(row),
        "apps": [dict(a) for a in apps],
        "analysis": {"summary": analysis["summary"], "source": analysis["source"]},
    })


# =====================================================================
# API: متابعة الاستهلاك + التنبيهات الذكية + الحظر لمدة ساعة
# =====================================================================
@app.route("/api/usage", methods=["POST"])
def api_usage():
    body = request.get_json(silent=True) or {}
    try:
        profile_id = int(body.get("profileId"))
        add_gb = float(body.get("addGb"))
    except (TypeError, ValueError):
        return jsonify({"error": "بيانات غير صحيحة"}), 400
    if add_gb <= 0:
        return jsonify({"error": "بيانات غير صحيحة"}), 400

    conn = get_db()
    p = conn.execute("SELECT * FROM profiles WHERE id=?", (profile_id,)).fetchone()
    if not p:
        conn.close()
        return jsonify({"error": "not found"}), 404

    now = datetime.utcnow()
    blocked_until = parse_dt(p["blockedUntil"])

    # التحقق من الحظر الحالي
    if p["blockingEnabled"] and blocked_until and blocked_until > now:
        conn.close()
        return jsonify({
            "profile": profile_to_dict(p),
            "blocked": True,
            "newAlerts": [{
                "type": "block",
                "message": "الإنترنت محظور مؤقتًا. يمكنك إلغاء الحظر من الإعدادات في حالات الطوارئ.",
            }],
        })

    new_today = round(p["todayUsage"] + add_gb, 2)
    new_used = round(p["usedGb"] + add_gb, 2)
    warning_count = p["warningCount"]
    new_blocked_until = p["blockedUntil"]
    new_alerts = []

    reached = new_today >= p["dailyLimit"]
    if reached:
        warning_count += 1
        if not p["blockingEnabled"]:
            new_alerts.append({
                "type": "info",
                "message": "تجاوزت الحد اليومي، لكن خاصية الحظر معطّلة (وضع الطوارئ). انتبه فقد لا تكفي الباقة لآخر الشهر.",
            })
        elif warning_count <= MAX_WARNINGS:
            remaining = MAX_WARNINGS - warning_count + 1
            word = "تنبيه" if remaining == 1 else "تنبيهات"
            new_alerts.append({
                "type": "warning",
                "message": f"تنبيه: وصلت للحد اليومي ({p['dailyLimit']} جيجا). لديك {remaining} {word} قبل حظر الإنترنت لمدة ساعة.",
            })
        else:
            block_dt = now + HOUR
            new_blocked_until = block_dt.isoformat()
            warning_count = 0
            new_alerts.append({
                "type": "block",
                "message": "تم حظر الإنترنت لمدة ساعة لحمايتك من استنفاد الباقة. يمكنك إلغاؤه من الإعدادات في الطوارئ.",
            })

    conn.execute(
        """UPDATE profiles SET todayUsage=?, usedGb=?, warningCount=?,
           blockedUntil=?, updatedAt=? WHERE id=?""",
        (new_today, new_used, warning_count, new_blocked_until, now_iso(), profile_id),
    )
    for a in new_alerts:
        conn.execute(
            "INSERT INTO alerts (profileId, type, message, createdAt) VALUES (?,?,?,?)",
            (profile_id, a["type"], a["message"], now_iso()),
        )
    conn.commit()
    updated = conn.execute("SELECT * FROM profiles WHERE id=?", (profile_id,)).fetchone()
    conn.close()

    b_until = parse_dt(updated["blockedUntil"])
    is_blocked = bool(updated["blockingEnabled"] and b_until and b_until > now)
    return jsonify({
        "profile": profile_to_dict(updated),
        "blocked": is_blocked,
        "newAlerts": new_alerts,
    })


# =====================================================================
# API: الإعدادات وإجراءات التحكم في البيانات
# =====================================================================
@app.route("/api/settings", methods=["POST"])
def api_settings():
    body = request.get_json(silent=True) or {}
    try:
        profile_id = int(body.get("profileId"))
    except (TypeError, ValueError):
        return jsonify({"error": "بيانات غير صحيحة"}), 400
    action = str(body.get("action", ""))

    conn = get_db()
    p = conn.execute("SELECT * FROM profiles WHERE id=?", (profile_id,)).fetchone()
    if not p:
        conn.close()
        return jsonify({"error": "not found"}), 404

    now = now_iso()
    updates = {"updatedAt": now}
    alert = None

    if action == "toggleBlocking":
        enabled = bool(body.get("enabled"))
        updates["blockingEnabled"] = 1 if enabled else 0
        if not enabled:
            updates["blockedUntil"] = None
            updates["warningCount"] = 0
        alert = {
            "type": "info",
            "message": "تم تفعيل خاصية الحظر عند تجاوز الحد اليومي."
            if enabled else
            "تم تعطيل خاصية الحظر (وضع الطوارئ). سيبقى الإنترنت مفتوحًا.",
        }
    elif action == "unblock":
        updates["blockedUntil"] = None
        updates["warningCount"] = 0
        alert = {"type": "info", "message": "تم إلغاء الحظر يدويًا (وضع الطوارئ). الإنترنت متاح الآن."}
    elif action == "resetDay":
        updates["todayUsage"] = 0
        updates["warningCount"] = 0
        updates["blockedUntil"] = None
        alert = {"type": "info", "message": "تم بدء يوم جديد. أُعيد ضبط استهلاك اليوم."}
    elif action == "upgradePlan":
        updates["plan"] = "paid"
        if not p["subscriptionStart"]:
            updates["subscriptionStart"] = now
        alert = {"type": "info", "message": "تم تفعيل الخطة المدفوعة — أول شهرين مجانًا! 🎉"}
    elif action == "downgradePlan":
        updates["plan"] = "free"
        alert = {"type": "info", "message": "تم التحويل إلى الخطة المجانية."}
    else:
        conn.close()
        return jsonify({"error": "إجراء غير معروف"}), 400

    cols = ", ".join(f"{k}=?" for k in updates)
    conn.execute(f"UPDATE profiles SET {cols} WHERE id=?",
                 (*updates.values(), profile_id))
    if alert:
        conn.execute(
            "INSERT INTO alerts (profileId, type, message, createdAt) VALUES (?,?,?,?)",
            (profile_id, alert["type"], alert["message"], now_iso()),
        )
    conn.commit()
    updated = conn.execute("SELECT * FROM profiles WHERE id=?", (profile_id,)).fetchone()
    conn.close()
    return jsonify({
        "profile": profile_to_dict(updated),
        "newAlerts": [alert] if alert else [],
    })


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
