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
const dailyLimitEl = $("dailyLimit");
const rewardPerCalorieEl = $("rewardPerCalorie");
const rewardCapEnabledEl = $("rewardCapEnabled");
const rewardCapEl = $("rewardCap");
const consumedEl = $("consumed");
const goalEl = $("goal");
const remainingEl = $("remaining");
const todayRewardEl = $("todayReward");
const mealListEl = $("mealList");
const rewardLogEl = $("rewardLog");
const ringEl = $("progressRing");

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
  state.meals = Array.isArray(data.meals) ? data.meals : [];
  state.rewards = Array.isArray(data.rewards) ? data.rewards : [];
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

function render() {
  const consumed = consumedToday();
  const remaining = Math.max(0, state.settings.dailyLimit - consumed);
  const pctConsumed = Math.max(0, Math.min(100, (consumed / state.settings.dailyLimit) * 100));

  goalEl.textContent = state.settings.dailyLimit;
  consumedEl.textContent = consumed;
  remainingEl.textContent = remaining;
  todayRewardEl.textContent = calcReward(remaining).toFixed(2);
  ringEl.style.background = `conic-gradient(var(--mint) ${100 - pctConsumed}%, #f0e4ef 0%)`;

  dailyLimitEl.value = state.settings.dailyLimit;
  rewardPerCalorieEl.value = state.settings.rewardPerCalorie;
  rewardCapEnabledEl.checked = state.settings.rewardCapEnabled;
  rewardCapEl.value = state.settings.rewardCap;
  rewardCapEl.disabled = !state.settings.rewardCapEnabled;

  mealListEl.innerHTML = "";
  getTodayMeals().forEach((m, idx) => {
    const li = document.createElement("li");
    li.className = "meal-item";
    li.innerHTML = `
      <div class="meal-meta">
        ${m.photo ? `<img class="thumb" src="${m.photo}" alt="food"/>` : "<div class='thumb'></div>"}
        <div>
          <div>${m.mealType}: ${m.foodName}</div>
          <small>${m.calories} cal</small>
        </div>
      </div>
      <button class="danger" data-idx="${idx}">Delete</button>`;
    mealListEl.appendChild(li);
  });

  rewardLogEl.innerHTML = "";
  [...state.rewards].reverse().forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.date}</td><td>${r.goal}</td><td>${r.eaten}</td><td>${r.remaining}</td><td>£${r.reward.toFixed(2)}</td>`;
    rewardLogEl.appendChild(tr);
  });

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

$("settingsForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.settings.dailyLimit = Math.max(1, Number(dailyLimitEl.value || 1000));
  state.settings.rewardPerCalorie = Math.max(0, Number(rewardPerCalorieEl.value || 1));
  state.settings.rewardCapEnabled = rewardCapEnabledEl.checked;
  state.settings.rewardCap = Math.max(0, Number(rewardCapEl.value || 10));
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
    date: todayISO(),
    mealType: $("mealType").value,
    foodName: $("foodName").value.trim(),
    calories,
    photo
  });

  e.target.reset();
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

$("estimateBtn").addEventListener("click", () => {
  const name = $("foodName").value.toLowerCase();
  const guesses = [
    { k: "apple", c: 95 }, { k: "banana", c: 105 }, { k: "pizza", c: 285 },
    { k: "pasta", c: 320 }, { k: "salad", c: 180 }, { k: "burger", c: 354 },
    { k: "rice", c: 200 }, { k: "egg", c: 78 }
  ];
  const hit = guesses.find((g) => name.includes(g.k));
  $("foodCalories").value = hit ? hit.c : 250;
});

$("closeDayBtn").addEventListener("click", () => {
  const eaten = consumedToday();
  const remaining = Math.max(0, state.settings.dailyLimit - eaten);
  const payload = {
    date: todayISO(),
    goal: state.settings.dailyLimit,
    eaten,
    remaining,
    reward: calcReward(remaining)
  };

  const existing = state.rewards.find((r) => r.date === payload.date);
  if (existing) Object.assign(existing, payload);
  else state.rewards.push(payload);

  render();
});

function toDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

setupTabs();
loadRemote().catch(() => {}).finally(() => render());
