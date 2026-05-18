const state = {
  settings: {
    dailyLimit: 1000,
    rewardPerCalorie: 1,
    rewardCapEnabled: false,
    rewardCap: 10
  },
  meals: [],
  rewards: []
};

const $ = (id) => document.getElementById(id);

const dailyLimitEl       = $("dailyLimit");
const rewardPerCalorieEl = $("rewardPerCalorie");
const rewardCapEnabledEl = $("rewardCapEnabled");
const rewardCapEl        = $("rewardCap");
const consumedEl         = $("consumed");
const goalEl             = $("goal");
const remainingEl        = $("remaining");
const todayRewardEl      = $("todayReward");
const mealListEl         = $("mealList");
const rewardLogEl        = $("rewardLog");
const ringEl             = $("progressRing");
const streakCountEl      = $("streakCount");
const totalEarnedEl      = $("totalEarned");
const rewardCardsEl      = $("rewardCards");
const estimateStatusEl   = $("estimateStatus");
const photoPreviewEl     = $("photoPreview");
const celebrationOverlay = $("celebrationOverlay");
const celebrateAmountEl  = $("celebrateAmount");

async function saveRemote() {
  await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
}

async function loadRemote() {
  const r = await fetch("/api/state");
  if (!r.ok) throw new Error("Failed to load state");
  const data = await r.json();
  state.settings = data.settings || state.settings;
  state.meals    = Array.isArray(data.meals)   ? data.meals   : [];
  state.rewards  = Array.isArray(data.rewards) ? data.rewards : [];
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTodayMeals() {
  return state.meals.filter((m) => m.date === todayISO());
}

function consumedToday() {
  return getTodayMeals().reduce((sum, m) => sum + m.calories, 0);
}

function calcReward(remaining) {
  const base = Math.max(0, remaining) * state.settings.rewardPerCalorie;
  if (!state.settings.rewardCapEnabled) return base;
  return Math.min(base, state.settings.rewardCap);
}

function calcTotalEarned() {
  return state.rewards.reduce((sum, r) => sum + r.reward, 0);
}

function calcStreak() {
  if (!state.rewards.length) return 0;
  const sorted = [...state.rewards].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  const todayStr = todayISO();
  const cursor = new Date();
  // If today isn't closed yet, allow streak to count from yesterday
  if (sorted[0].date !== todayStr) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (const r of sorted) {
    const rDate = new Date(r.date + "T12:00:00");
    const expected = new Date(cursor);
    expected.setHours(12, 0, 0, 0);
    if (rDate.toDateString() !== expected.toDateString()) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function renderRewardCards(newestDate) {
  rewardCardsEl.innerHTML = "";
  [...state.rewards]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((r) => {
      const card = document.createElement("div");
      card.className = "reward-card" + (r.date === newestDate ? " sparkle" : "");
      const starCount = Math.min(20, Math.round(r.reward / 0.5));
      const stars = Array.from({ length: starCount }, (_, i) =>
        `<span class="reward-star" style="animation-delay:${i * 0.05}s">⭐</span>`
      ).join("");
      card.innerHTML = `
        <div class="reward-card-date">${formatDate(r.date)}</div>
        <div class="reward-card-amount">£${r.reward.toFixed(2)}</div>
        <div class="reward-card-stars">${stars || "🌙"}</div>
        <div class="reward-card-stats">${r.eaten} eaten · ${r.goal} goal · ${r.remaining} remaining</div>`;
      rewardCardsEl.appendChild(card);
    });
}

function render() {
  const consumed = consumedToday();
  const remaining = Math.max(0, state.settings.dailyLimit - consumed);
  const pctConsumed = Math.max(0, Math.min(100, (consumed / state.settings.dailyLimit) * 100));

  goalEl.textContent      = state.settings.dailyLimit;
  consumedEl.textContent  = consumed;
  remainingEl.textContent = remaining;
  todayRewardEl.textContent = calcReward(remaining).toFixed(2);
  ringEl.style.background = `conic-gradient(var(--mint) ${100 - pctConsumed}%, var(--ring-track) 0%)`;
  ringEl.classList.toggle("under-goal", consumed < state.settings.dailyLimit);

  dailyLimitEl.value        = state.settings.dailyLimit;
  rewardPerCalorieEl.value  = state.settings.rewardPerCalorie;
  rewardCapEnabledEl.checked = state.settings.rewardCapEnabled;
  rewardCapEl.value         = state.settings.rewardCap;
  rewardCapEl.disabled      = !state.settings.rewardCapEnabled;

  streakCountEl.textContent  = calcStreak();
  totalEarnedEl.textContent  = calcTotalEarned().toFixed(2);

  mealListEl.innerHTML = "";
  getTodayMeals().forEach((m, idx) => {
    const li = document.createElement("li");
    li.className = "meal-item";
    li.innerHTML = `
      <div class="meal-meta">
        ${m.photo
          ? `<img class="thumb" src="${m.photo}" alt="food"/>`
          : "<div class='thumb'></div>"}
        <div class="meal-info">
          <div>${m.mealType}: ${m.foodName}</div>
          <small>${m.calories} cal</small>
        </div>
      </div>
      <button class="danger" data-idx="${idx}">Delete</button>`;
    mealListEl.appendChild(li);
  });

  // Hidden compat table
  rewardLogEl.innerHTML = "";
  [...state.rewards].reverse().forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.date}</td><td>${r.goal}</td><td>${r.eaten}</td><td>${r.remaining}</td><td>£${r.reward.toFixed(2)}</td>`;
    rewardLogEl.appendChild(tr);
  });

  renderRewardCards(null);

  saveRemote().catch(() => {});
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      const target = tab.dataset.tab;
      document.querySelectorAll(".panel").forEach((p) => {
        const on = p.id === target;
        p.classList.toggle("active", on);
        p.hidden = !on;
      });
    });
  });
}

function setupMealTypeButtons() {
  document.querySelectorAll(".meal-type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".meal-type-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      $("mealType").value = btn.dataset.meal;
    });
  });
}

$("settingsForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.settings.dailyLimit      = Math.max(1, Number(dailyLimitEl.value || 1000));
  state.settings.rewardPerCalorie = Math.max(0, Number(rewardPerCalorieEl.value || 1));
  state.settings.rewardCapEnabled = rewardCapEnabledEl.checked;
  state.settings.rewardCap       = Math.max(0, Number(rewardCapEl.value || 10));
  render();
});

$("foodForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const calories = Number($("foodCalories").value);
  if (!Number.isFinite(calories) || calories < 0) return;

  const file = $("foodPhoto").files?.[0];
  let photo = "";
  if (file) photo = await toDataURL(file);

  state.meals.push({
    date:     todayISO(),
    mealType: $("mealType").value,
    foodName: $("foodName").value.trim(),
    calories,
    photo
  });

  e.target.reset();

  // Reset meal type buttons
  document.querySelectorAll(".meal-type-btn").forEach((b, i) =>
    b.classList.toggle("active", i === 0)
  );
  $("mealType").value = "Breakfast";

  // Clear photo preview
  photoPreviewEl.classList.add("hidden");
  photoPreviewEl.src = "";
  const cameraText = $("cameraBtnLabel").querySelector(".camera-text");
  if (cameraText) cameraText.textContent = "Tap to snap your food!";

  render();
});

mealListEl.addEventListener("click", (e) => {
  if (!(e.target instanceof HTMLButtonElement)) return;
  if (!e.target.classList.contains("danger")) return;
  const idx = Number(e.target.dataset.idx);
  const todays = getTodayMeals();
  const selected = todays[idx];
  if (!selected) return;
  const pos = state.meals.findIndex((m) => m === selected);
  if (pos >= 0) state.meals.splice(pos, 1);
  render();
});

// Auto-estimate when photo is selected
$("foodPhoto").addEventListener("change", async () => {
  const file = $("foodPhoto").files[0];
  if (!file) return;

  const dataUrl = await toDataURL(file);

  // Show preview
  photoPreviewEl.src = dataUrl;
  photoPreviewEl.classList.remove("hidden");
  const cameraText = $("cameraBtnLabel").querySelector(".camera-text");
  if (cameraText) cameraText.textContent = "Tap to change photo";

  // Auto-estimate
  estimateStatusEl.classList.remove("hidden");
  $("estimateBtn").disabled = true;

  try {
    const r = await fetch("/api/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl })
    });
    const data = await r.json();
    if (r.ok) $("foodCalories").value = data.calories;
  } catch (_) {
    // ignore — user can type or re-estimate manually
  } finally {
    estimateStatusEl.classList.add("hidden");
    $("estimateBtn").disabled = false;
  }
});

// Re-estimate button (manual fallback)
$("estimateBtn").addEventListener("click", async () => {
  const file = $("foodPhoto").files[0];
  const btn = $("estimateBtn");

  if (file) {
    btn.disabled = true;
    btn.textContent = "Estimating…";
    try {
      const dataUrl = await toDataURL(file);
      const r = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl })
      });
      const data = await r.json();
      if (r.ok) {
        $("foodCalories").value = data.calories;
      } else {
        alert("Could not estimate: " + (data.error || "unknown error"));
      }
    } catch (err) {
      alert("Estimation failed: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "🔄 Re-estimate";
    }
    return;
  }

  // Keyword fallback when no photo
  const name = $("foodName").value.toLowerCase();
  const guesses = [
    { k: "apple",  c: 95  }, { k: "banana", c: 105 }, { k: "pizza",  c: 285 },
    { k: "pasta",  c: 320 }, { k: "salad",  c: 180 }, { k: "burger", c: 354 },
    { k: "rice",   c: 200 }, { k: "egg",    c: 78  }
  ];
  const hit = guesses.find((g) => name.includes(g.k));
  $("foodCalories").value = hit ? hit.c : "";
});

$("closeDayBtn").addEventListener("click", () => {
  const eaten     = consumedToday();
  const remaining = Math.max(0, state.settings.dailyLimit - eaten);
  const payload   = {
    date:      todayISO(),
    goal:      state.settings.dailyLimit,
    eaten,
    remaining,
    reward:    calcReward(remaining)
  };

  const existing = state.rewards.find((r) => r.date === payload.date);
  if (existing) Object.assign(existing, payload);
  else state.rewards.push(payload);

  // Celebration overlay
  celebrateAmountEl.textContent = payload.reward.toFixed(2);
  celebrationOverlay.classList.remove("hidden");
  renderRewardCards(payload.date);

  render();

  setTimeout(() => celebrationOverlay.classList.add("hidden"), 2500);
});

function toDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

setupTabs();
setupMealTypeButtons();
celebrationOverlay.addEventListener("click", () =>
  celebrationOverlay.classList.add("hidden")
);
loadRemote().catch(() => {}).finally(() => render());
