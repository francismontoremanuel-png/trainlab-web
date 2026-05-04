// ====== TrainLab - Web App Gym ======
const STORAGE_KEY = "trainlab_data_v1";

const state = {
  currentView: "inicio",
  user: null,
  routine: [],
  workouts: [],
  currentWorkout: null,
  exerciseLibrary: getExerciseLibrary(),
  filters: {
    muscle: "all",
    equipment: "all",
  },
};

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      user: state.user,
      routine: state.routine,
      workouts: state.workouts,
    })
  );
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.user = parsed.user || null;
    state.routine = parsed.routine || [];
    state.workouts = parsed.workouts || [];
  } catch (e) {
    console.error("Error leyendo localStorage", e);
  }
}

function getTodayName() {
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return days[new Date().getDay()];
}

function getWeekdayIndexFromPlan(dayLabel) {
  const map = {
    Lunes: 1,
    Martes: 2,
    Miércoles: 3,
    Jueves: 4,
    Viernes: 5,
    Sábado: 6,
    Domingo: 0,
  };
  return map[dayLabel] ?? 1;
}

function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function calcStreak(workouts) {
  if (!workouts.length) return 0;
  const dates = workouts
    .map(w => new Date(w.date).toDateString())
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map(d => new Date(d))
    .sort((a, b) => b - a);

  let streak = 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = 0; i < dates.length; i++) {
    const day = new Date(dates[i]);
    day.setHours(0, 0, 0, 0);
    const expected = new Date(now);
    expected.setDate(now.getDate() - i);
    if (day.getTime() === expected.getTime()) {
      streak++;
    } else {
      // Permite que si hoy no entrenó, pero sí ayer, empiece en ayer
      if (i === 0) {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (day.getTime() === yesterday.getTime()) {
          streak = 1;
          continue;
        }
      }
      break;
    }
  }
  return streak;
}

function totalVolume(workouts) {
  let vol = 0;
  workouts.forEach(w => {
    w.sets?.forEach(s => {
      vol += (Number(s.weight) || 0) * (Number(s.reps) || 0);
    });
  });
  return vol;
}

function getPersonalRecords(workouts) {
  const pr = {}; // exerciseName -> maxWeight
  workouts.forEach(w => {
    const ex = w.exerciseName;
    if (!pr[ex]) pr[ex] = 0;
    w.sets?.forEach(s => {
      const weight = Number(s.weight) || 0;
      if (weight > pr[ex]) pr[ex] = weight;
    });
  });
  return pr;
}

function getBodyWeightHistory(workouts) {
  return workouts
    .filter(w => w.bodyWeight)
    .map(w => ({ date: w.date, bodyWeight: w.bodyWeight }));
}

function getExerciseLibrary() {
  return [
    { name: "Press banca", muscle: "Pecho", equipment: "Barra", rest: "120s", technique: "Escápulas retraídas, pies firmes.", mistakes: "Rebotar barra, codos abiertos." },
    { name: "Press inclinado mancuernas", muscle: "Pecho", equipment: "Mancuernas", rest: "90s", technique: "Controla bajada y sube en línea.", mistakes: "Arqueo excesivo lumbar." },
    { name: "Dominadas asistidas", muscle: "Espalda", equipment: "Máquinas", rest: "120s", technique: "Pecho arriba, tira con codo.", mistakes: "Balanceo y tirón de cuello." },
    { name: "Remo con barra", muscle: "Espalda", equipment: "Barra", rest: "90s", technique: "Espalda neutra, codo hacia atrás.", mistakes: "Redondear lumbar." },
    { name: "Sentadilla trasera", muscle: "Pierna", equipment: "Barra", rest: "150s", technique: "Rodillas siguen punta de pies.", mistakes: "Talones se levantan." },
    { name: "Prensa 45°", muscle: "Pierna", equipment: "Máquinas", rest: "120s", technique: "Recorrido controlado sin bloquear.", mistakes: "Despegar cadera del asiento." },
    { name: "Press militar", muscle: "Hombros", equipment: "Barra", rest: "90s", technique: "Core firme, barra vertical.", mistakes: "Hiperextensión lumbar." },
    { name: "Elevaciones laterales", muscle: "Hombros", equipment: "Mancuernas", rest: "60s", technique: "Sube hasta línea de hombro.", mistakes: "Impulso con trapecio." },
    { name: "Curl bíceps alterno", muscle: "Bíceps", equipment: "Mancuernas", rest: "60s", technique: "Codo fijo al costado.", mistakes: "Balanceo de torso." },
    { name: "Fondos en polea", muscle: "Tríceps", equipment: "Poleas", rest: "60s", technique: "Extiende completo sin mover hombro.", mistakes: "Abrir codos." },
    { name: "Crunch en polea", muscle: "Abdomen", equipment: "Poleas", rest: "45s", technique: "Flexión de columna controlada.", mistakes: "Tirar con brazos." },
    { name: "Hip thrust", muscle: "Glúteo", equipment: "Barra", rest: "120s", technique: "Mentón al pecho, pausa arriba.", mistakes: "Extender zona lumbar." },
  ];
}

function getAlternatives(exercise) {
  const sameMuscle = state.exerciseLibrary.filter(
    ex => ex.muscle === exercise.muscle && ex.name !== exercise.name
  );
  return sameMuscle.slice(0, 3);
}

function generateRoutine(user) {
  const days = Number(user.daysPerWeek);
  const lib = state.exerciseLibrary;

  const byMuscle = muscle => lib.filter(e => e.muscle === muscle);

  function pack(day, focus, picks) {
    return { day, focus, exercises: picks };
  }

  if (days === 3) {
    return [
      pack("Lunes", "Full Body A", [byMuscle("Pierna")[0], byMuscle("Pecho")[0], byMuscle("Espalda")[0], byMuscle("Hombros")[1], byMuscle("Abdomen")[0]]),
      pack("Miércoles", "Full Body B", [byMuscle("Pierna")[1], byMuscle("Pecho")[1], byMuscle("Espalda")[1], byMuscle("Bíceps")[0], byMuscle("Tríceps")[0]]),
      pack("Viernes", "Full Body C", [byMuscle("Glúteo")[0], byMuscle("Pecho")[0], byMuscle("Espalda")[0], byMuscle("Hombros")[0], byMuscle("Abdomen")[0]]),
    ];
  }

  if (days === 4) {
    return [
      pack("Lunes", "Upper A", [byMuscle("Pecho")[0], byMuscle("Espalda")[0], byMuscle("Hombros")[0], byMuscle("Bíceps")[0], byMuscle("Tríceps")[0]]),
      pack("Martes", "Lower A", [byMuscle("Pierna")[0], byMuscle("Pierna")[1], byMuscle("Glúteo")[0], byMuscle("Abdomen")[0]]),
      pack("Jueves", "Upper B", [byMuscle("Pecho")[1], byMuscle("Espalda")[1], byMuscle("Hombros")[1], byMuscle("Bíceps")[0], byMuscle("Tríceps")[0]]),
      pack("Viernes", "Lower B", [byMuscle("Pierna")[1], byMuscle("Pierna")[0], byMuscle("Glúteo")[0], byMuscle("Abdomen")[0]]),
    ];
  }

  if (days === 5) {
    return [
      pack("Lunes", "Push", [byMuscle("Pecho")[0], byMuscle("Pecho")[1], byMuscle("Hombros")[0], byMuscle("Tríceps")[0]]),
      pack("Martes", "Pull", [byMuscle("Espalda")[0], byMuscle("Espalda")[1], byMuscle("Bíceps")[0], byMuscle("Abdomen")[0]]),
      pack("Miércoles", "Legs", [byMuscle("Pierna")[0], byMuscle("Pierna")[1], byMuscle("Glúteo")[0], byMuscle("Abdomen")[0]]),
      pack("Jueves", "Upper", [byMuscle("Pecho")[1], byMuscle("Espalda")[0], byMuscle("Hombros")[1], byMuscle("Bíceps")[0], byMuscle("Tríceps")[0]]),
      pack("Viernes", "Lower", [byMuscle("Pierna")[1], byMuscle("Pierna")[0], byMuscle("Glúteo")[0], byMuscle("Abdomen")[0]]),
    ];
  }

  // 6 días o más -> PPL x2
  return [
    pack("Lunes", "Push A", [byMuscle("Pecho")[0], byMuscle("Hombros")[0], byMuscle("Tríceps")[0]]),
    pack("Martes", "Pull A", [byMuscle("Espalda")[0], byMuscle("Espalda")[1], byMuscle("Bíceps")[0]]),
    pack("Miércoles", "Legs A", [byMuscle("Pierna")[0], byMuscle("Pierna")[1], byMuscle("Abdomen")[0]]),
    pack("Jueves", "Push B", [byMuscle("Pecho")[1], byMuscle("Hombros")[1], byMuscle("Tríceps")[0]]),
    pack("Viernes", "Pull B", [byMuscle("Espalda")[1], byMuscle("Espalda")[0], byMuscle("Bíceps")[0]]),
    pack("Sábado", "Legs B", [byMuscle("Pierna")[1], byMuscle("Glúteo")[0], byMuscle("Abdomen")[0]]),
  ];
}

function render() {
  const main = document.getElementById("mainContent");
  const nav = document.getElementById("bottomNav");

  // Si no hay usuario, forzar onboarding / formulario
  if (!state.user) {
    nav.classList.add("hidden");
    if (state.currentView !== "onboarding" && state.currentView !== "form") {
      state.currentView = "onboarding";
    }
  } else {
    nav.classList.remove("hidden");
  }

  main.innerHTML = "";

  if (state.currentView === "onboarding") renderOnboarding(main);
  else if (state.currentView === "form") renderForm(main);
  else if (state.currentView === "inicio") renderDashboard(main);
  else if (state.currentView === "rutina") renderRoutine(main);
  else if (state.currentView === "progreso") renderProgress(main);
  else if (state.currentView === "ejercicios") renderLibrary(main);
  else if (state.currentView === "perfil") renderProfile(main);
  else if (state.currentView === "exerciseDetail") renderExerciseDetail(main, state.selectedExercise);
  else if (state.currentView === "logSets") renderLogSets(main, state.selectedExercise);

  updateActiveNav();
}

function updateActiveNav() {
  const buttons = document.querySelectorAll(".nav-item");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === state.currentView);
  });
}

function renderOnboarding(main) {
  main.innerHTML = `
    <section class="hero">
      <h2>Tu entrenador personal de gimnasio en el bolsillo</h2>
      <p>Planifica tu rutina, registra cada serie y mejora semana a semana con datos reales.</p>
      <button class="btn btn-primary" id="startOnboarding">Crear mi rutina</button>
    </section>
    <section class="card">
      <h3>¿Qué puedes hacer con TrainLab?</h3>
      <div class="list">
        <div class="small">• Rutina adaptada a tus días disponibles.</div>
        <div class="small">• Registro por series: peso, repeticiones y RPE.</div>
        <div class="small">• Seguimiento de récords personales y volumen.</div>
      </div>
    </section>
  `;

  document.getElementById("startOnboarding").addEventListener("click", () => {
    state.currentView = "form";
    render();
  });
}

function renderForm(main) {
  main.innerHTML = `
    <section class="card">
      <h2>Datos para tu rutina personalizada</h2>
      <form id="userForm" class="form-grid">
        <div class="field"><label>Nombre</label><input class="input" name="name" required /></div>
        <div class="grid-2">
          <div class="field"><label>Edad</label><input class="input" type="number" name="age" required /></div>
          <div class="field"><label>Sexo</label>
            <select name="sex" required>
              <option value="">Selecciona</option>
              <option>Hombre</option><option>Mujer</option><option>Otro</option>
            </select>
          </div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Altura (cm)</label><input class="input" type="number" name="height" required /></div>
          <div class="field"><label>Peso (kg)</label><input class="input" type="number" step="0.1" name="weight" required /></div>
        </div>
        <div class="field"><label>Objetivo principal</label>
          <select name="goal" required>
            <option value="">Selecciona</option>
            <option>Ganar masa muscular</option>
            <option>Perder grasa</option>
            <option>Recomposición corporal</option>
            <option>Mejorar fuerza</option>
          </select>
        </div>
        <div class="field"><label>Nivel de entrenamiento</label>
          <select name="level" required>
            <option value="">Selecciona</option>
            <option>Principiante</option>
            <option>Intermedio</option>
            <option>Avanzado</option>
          </select>
        </div>
        <div class="grid-2">
          <div class="field"><label>Días por semana</label>
            <select name="daysPerWeek" required>
              <option value="">Selecciona</option>
              <option value="3">3</option><option value="4">4</option>
              <option value="5">5</option><option value="6">6</option>
            </select>
          </div>
          <div class="field"><label>Tiempo por sesión (min)</label>
            <input class="input" type="number" name="sessionTime" required />
          </div>
        </div>
        <div class="field"><label>Prioridad muscular</label>
          <input class="input" name="priority" placeholder="Ej: Espalda y glúteo" />
        </div>
        <div class="field"><label>Lesiones o molestias</label>
          <textarea name="injuries" placeholder="Ej: molestias en hombro derecho"></textarea>
        </div>
        <button class="btn btn-primary" type="submit">Generar rutina</button>
      </form>
    </section>
  `;

  document.getElementById("userForm").addEventListener("submit", e => {
    e.preventDefault();
    const form = new FormData(e.target);

    state.user = {
      name: form.get("name"),
      age: Number(form.get("age")),
      sex: form.get("sex"),
      height: Number(form.get("height")),
      weight: Number(form.get("weight")),
      goal: form.get("goal"),
      level: form.get("level"),
      daysPerWeek: Number(form.get("daysPerWeek")),
      sessionTime: Number(form.get("sessionTime")),
      priority: form.get("priority"),
      injuries: form.get("injuries"),
      createdAt: new Date().toISOString(),
    };

    state.routine = generateRoutine(state.user);
    saveState();
    state.currentView = "inicio";
    render();
  });
}

function getTodayRoutine() {
  if (!state.routine.length) return null;
  const todayIdx = new Date().getDay();
  const sorted = [...state.routine].sort((a, b) => getWeekdayIndexFromPlan(a.day) - getWeekdayIndexFromPlan(b.day));
  return sorted.find(day => getWeekdayIndexFromPlan(day.day) === todayIdx) || sorted[0];
}

function renderDashboard(main) {
  const today = getTodayRoutine();
  const streak = calcStreak(state.workouts);
  const weeklyDone = state.workouts.filter(w => {
    const wd = new Date(w.date);
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    return wd >= weekAgo && wd <= now;
  }).length;

  main.innerHTML = `
    <section class="hero">
      <h2>Hola, ${state.user.name}</h2>
      <p>${state.user.goal} · Nivel ${state.user.level}</p>
      <button class="btn btn-primary" id="startWorkoutBtn">Empezar entrenamiento</button>
    </section>

    <section class="card">
      <div class="row-between">
        <h2>Entrenamiento de hoy</h2>
        <span class="badge">${today ? today.day : getTodayName()}</span>
      </div>
      ${
        today
          ? `<div class="small"><strong>${today.focus}</strong> · ${today.exercises.length} ejercicios</div>`
          : `<div class="small">No hay rutina disponible.</div>`
      }
    </section>

    <section class="grid-2">
      <article class="kpi"><span class="label">Progreso semanal</span><span class="value">${weeklyDone} entrenos</span></article>
      <article class="kpi"><span class="label">Entrenos completados</span><span class="value">${state.workouts.length}</span></article>
      <article class="kpi"><span class="label">Racha</span><span class="value">${streak} días</span></article>
      <article class="kpi"><span class="label">Volumen total</span><span class="value">${totalVolume(state.workouts).toFixed(0)} kg</span></article>
    </section>
  `;

  document.getElementById("startWorkoutBtn").addEventListener("click", () => {
    state.currentView = "rutina";
    render();
  });
}

function renderRoutine(main) {
  const routineHtml = state.routine
    .map(day => {
      const exHtml = day.exercises
        .map(
          ex => `
          <div class="exercise-item">
            <div class="row-between">
              <strong>${ex.name}</strong>
              <span class="badge">${ex.muscle}</span>
            </div>
            <div class="small">Series: 3-4 · Reps: 6-12 · Descanso: ${ex.rest}</div>
            <div class="row">
              <button class="btn btn-secondary btn-view-ex" data-ex="${ex.name}">Detalle</button>
              <button class="btn btn-secondary btn-log-ex" data-ex="${ex.name}">Registrar</button>
            </div>
          </div>
        `
        )
        .join("");

      return `
        <article class="card">
          <h3>${day.day} · ${day.focus}</h3>
          <div class="list">${exHtml}</div>
        </article>
      `;
    })
    .join("");

  main.innerHTML = `
    <section class="card">
      <h2>Rutina semanal</h2>
      <div class="small">Plan generado para ${state.user.daysPerWeek} días / semana.</div>
      <hr class="sep" />
      <button id="editRoutineBtn" class="btn btn-ghost">Regenerar rutina</button>
    </section>
    ${routineHtml}
  `;

  document.getElementById("editRoutineBtn").addEventListener("click", () => {
    state.routine = generateRoutine(state.user);
    saveState();
    render();
  });

  document.querySelectorAll(".btn-view-ex").forEach(btn => {
    btn.addEventListener("click", () => {
      const ex = state.exerciseLibrary.find(e => e.name === btn.dataset.ex);
      state.selectedExercise = ex;
      state.currentView = "exerciseDetail";
      render();
    });
  });

  document.querySelectorAll(".btn-log-ex").forEach(btn => {
    btn.addEventListener("click", () => {
      const ex = state.exerciseLibrary.find(e => e.name === btn.dataset.ex);
      state.selectedExercise = ex;
      state.currentView = "logSets";
      render();
    });
  });
}

function renderExerciseDetail(main, ex) {
  if (!ex) {
    state.currentView = "rutina";
    return render();
  }

  const prMap = getPersonalRecords(state.workouts);
  const lastLog = [...state.workouts].reverse().find(w => w.exerciseName === ex.name);
  const alternatives = getAlternatives(ex);

  main.innerHTML = `
    <section class="card">
      <div class="row-between">
        <h2>${ex.name}</h2>
        <button class="btn btn-ghost" id="backToRoutine">Volver</button>
      </div>
      <div class="small">Músculo principal: <strong>${ex.muscle}</strong></div>
      <div class="small">Material necesario: <strong>${ex.equipment}</strong></div>
      <hr class="sep" />
      <h3>Técnica básica</h3>
      <p class="small">${ex.technique}</p>
      <h3>Errores comunes</h3>
      <p class="small">${ex.mistakes}</p>
      <hr class="sep" />
      <div class="grid-2">
        <article class="kpi">
          <span class="label">Último peso usado</span>
          <span class="value">${lastLog?.sets?.length ? Math.max(...lastLog.sets.map(s => Number(s.weight) || 0)) : 0} kg</span>
        </article>
        <article class="kpi">
          <span class="label">Récord personal</span>
          <span class="value">${prMap[ex.name] || 0} kg</span>
        </article>
      </div>
    </section>

    <section class="card">
      <h3>Sustitución de ejercicio</h3>
      <div class="small">Si la máquina está ocupada, prueba estas alternativas:</div>
      <div class="list" style="margin-top:8px;">
        ${
          alternatives.length
            ? alternatives.map(a => `<div class="exercise-item"><strong>${a.name}</strong><div class="small">${a.equipment} · ${a.muscle}</div></div>`).join("")
            : `<div class="small">No hay alternativas cargadas.</div>`
        }
      </div>
    </section>
  `;

  document.getElementById("backToRoutine").addEventListener("click", () => {
    state.currentView = "rutina";
    render();
  });
}

function renderLogSets(main, ex) {
  if (!ex) {
    state.currentView = "rutina";
    return render();
  }

  let tempSets = [];

  main.innerHTML = `
    <section class="card">
      <div class="row-between">
        <h2>Registro de series</h2>
        <button class="btn btn-ghost" id="backRoutine2">Volver</button>
      </div>
      <div class="small"><strong>${ex.name}</strong> · ${ex.muscle}</div>

      <form id="setForm" class="form-grid" style="margin-top:10px;">
        <div class="grid-2">
          <div class="field"><label>Peso (kg)</label><input class="input" type="number" step="0.5" name="weight" required /></div>
          <div class="field"><label>Repeticiones</label><input class="input" type="number" name="reps" required /></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>RPE (1-10)</label><input class="input" type="number" min="1" max="10" name="rpe" required /></div>
          <div class="field"><label>Peso corporal (opcional)</label><input class="input" type="number" step="0.1" name="bodyWeight" /></div>
        </div>
        <div class="field"><label>Notas</label><textarea name="notes" placeholder="Ej: última serie cerca del fallo"></textarea></div>
        <button class="btn btn-secondary" type="submit">Añadir serie</button>
      </form>

      <div id="setsList" class="list" style="margin-top:10px;"></div>
      <button class="btn btn-primary" id="finishExerciseBtn" style="margin-top:10px;">Terminar ejercicio</button>
    </section>
  `;

  function refreshSets() {
    const list = document.getElementById("setsList");
    if (!tempSets.length) {
      list.innerHTML = `<div class="small">Aún no has añadido series.</div>`;
      return;
    }
    list.innerHTML = tempSets
      .map(
        (s, i) => `
        <div class="exercise-item">
          <strong>Serie ${i + 1}</strong>
          <div class="small">${s.weight} kg × ${s.reps} reps · RPE ${s.rpe}</div>
          <div class="small">${s.notes || "Sin notas"}</div>
        </div>
      `
      )
      .join("");
  }

  refreshSets();

  document.getElementById("setForm").addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    tempSets.push({
      weight: Number(fd.get("weight")),
      reps: Number(fd.get("reps")),
      rpe: Number(fd.get("rpe")),
      notes: fd.get("notes"),
    });
    refreshSets();
    e.target.reset();
  });

  document.getElementById("finishExerciseBtn").addEventListener("click", () => {
    if (!tempSets.length) {
      alert("Añade al menos una serie.");
      return;
    }

    const bodyWeightInput = document.querySelector('input[name="bodyWeight"]');
    const bodyWeight = bodyWeightInput?.value ? Number(bodyWeightInput.value) : null;

    state.workouts.push({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      exerciseName: ex.name,
      muscle: ex.muscle,
      sets: tempSets,
      bodyWeight,
    });

    saveState();
    alert("Entrenamiento guardado ✅");
    state.currentView = "progreso";
    render();
  });

  document.getElementById("backRoutine2").addEventListener("click", () => {
    state.currentView = "rutina";
    render();
  });
}

function renderProgress(main) {
  const prMap = getPersonalRecords(state.workouts);
  const bw = getBodyWeightHistory(state.workouts);

  const history = [...state.workouts]
    .reverse()
    .slice(0, 20)
    .map(
      w => `
      <div class="exercise-item">
        <strong>${w.exerciseName}</strong>
        <div class="small">${formatDate(w.date)} · ${w.sets.length} series</div>
        <div class="small">Volumen: ${w.sets.reduce((a, s) => a + (s.weight * s.reps), 0).toFixed(0)} kg</div>
      </div>
    `
    )
    .join("");

  const prHtml = Object.keys(prMap).length
    ? Object.entries(prMap)
        .map(([name, val]) => `<div class="exercise-item"><strong>${name}</strong><div class="small">PR: ${val} kg</div></div>`)
        .join("")
    : `<div class="small">Aún no hay récords guardados.</div>`;

  const bwHtml = bw.length
    ? bw
        .slice(-6)
        .map(x => `<div class="small">${formatDate(x.date)}: ${x.bodyWeight} kg</div>`)
        .join("")
    : `<div class="small">Sin registros de peso corporal.</div>`;

  main.innerHTML = `
    <section class="grid-2">
      <article class="kpi"><span class="label">Entrenos completados</span><span class="value">${state.workouts.length}</span></article>
      <article class="kpi"><span class="label">Volumen total</span><span class="value">${totalVolume(state.workouts).toFixed(0)} kg</span></article>
    </section>

    <section class="card">
      <h2>Récords personales</h2>
      <div class="list">${prHtml}</div>
    </section>

    <section class="card">
      <h2>Peso corporal</h2>
      <div class="list">${bwHtml}</div>
    </section>

    <section class="card">
      <h2>Historial guardado</h2>
      <div class="list">${history || `<div class="small">No hay historial todavía.</div>`}</div>
    </section>
  `;
}

function renderLibrary(main) {
  const muscles = ["all", "Pecho", "Espalda", "Pierna", "Hombros", "Bíceps", "Tríceps", "Abdomen", "Glúteo"];
  const equipments = ["all", "Máquinas", "Poleas", "Mancuernas", "Barra"];

  const filtered = state.exerciseLibrary.filter(ex => {
    const mOk = state.filters.muscle === "all" || ex.muscle === state.filters.muscle;
    const eOk = state.filters.equipment === "all" || ex.equipment === state.filters.equipment;
    return mOk && eOk;
  });

  main.innerHTML = `
    <section class="card">
      <h2>Biblioteca de ejercicios</h2>
      <div class="form-grid">
        <div class="field">
          <label>Filtro por músculo</label>
          <select id="muscleFilter">
            ${muscles.map(m => `<option value="${m}" ${state.filters.muscle === m ? "selected" : ""}>${m === "all" ? "Todos" : m}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Filtro por material</label>
          <select id="equipFilter">
            ${equipments.map(e => `<option value="${e}" ${state.filters.equipment === e ? "selected" : ""}>${e === "all" ? "Todos" : e}</option>`).join("")}
          </select>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="list">
        ${
          filtered.length
            ? filtered
                .map(
                  ex => `
                  <div class="exercise-item">
                    <div class="row-between">
                      <strong>${ex.name}</strong>
                      <span class="badge">${ex.muscle}</span>
                    </div>
                    <div class="small">${ex.equipment}</div>
                    <button class="btn btn-secondary btn-open-detail" data-ex="${ex.name}">Ver detalle</button>
                  </div>
                `
                )
                .join("")
            : `<div class="small">No hay ejercicios con esos filtros.</div>`
        }
      </div>
    </section>
  `;

  document.getElementById("muscleFilter").addEventListener("change", e => {
    state.filters.muscle = e.target.value;
    render();
  });

  document.getElementById("equipFilter").addEventListener("change", e => {
    state.filters.equipment = e.target.value;
    render();
  });

  document.querySelectorAll(".btn-open-detail").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedExercise = state.exerciseLibrary.find(e => e.name === btn.dataset.ex);
      state.currentView = "exerciseDetail";
      render();
    });
  });
}

function renderProfile(main) {
  main.innerHTML = `
    <section class="card">
      <h2>Perfil</h2>
      <div class="small">Nombre: <strong>${state.user.name}</strong></div>
      <div class="small">Objetivo: <strong>${state.user.goal}</strong></div>
      <div class="small">Nivel: <strong>${state.user.level}</strong></div>
      <div class="small">Días de entrenamiento: <strong>${state.user.daysPerWeek}</strong></div>
      <div class="small">Tiempo por sesión: <strong>${state.user.sessionTime} min</strong></div>
      <div class="small">Prioridad muscular: <strong>${state.user.priority || "No definida"}</strong></div>
      <div class="small">Lesiones/molestias: <strong>${state.user.injuries || "Ninguna"}</strong></div>
      <hr class="sep" />
      <div class="row">
        <button class="btn btn-secondary" id="resetDataBtn">Reiniciar datos</button>
        <button class="btn btn-danger" id="deleteAllBtn">Borrar cuenta/datos</button>
      </div>
    </section>
  `;

  document.getElementById("resetDataBtn").addEventListener("click", () => {
    if (!confirm("¿Reiniciar formulario y rutina?")) return;
    const keepName = state.user.name;
    state.user = {
      name: keepName,
      age: "",
      sex: "",
      height: "",
      weight: "",
      goal: "",
      level: "",
      daysPerWeek: 3,
      sessionTime: 60,
      priority: "",
      injuries: "",
    };
    state.routine = generateRoutine({ ...state.user, daysPerWeek: 3 });
    saveState();
    alert("Datos reiniciados.");
    render();
  });

  document.getElementById("deleteAllBtn").addEventListener("click", () => {
    if (!confirm("Esto borrará TODOS tus datos de TrainLab. ¿Continuar?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state.user = null;
    state.routine = [];
    state.workouts = [];
    state.currentView = "onboarding";
    render();
  });
}

// ====== Events globales ======
document.getElementById("bottomNav").addEventListener("click", e => {
  const btn = e.target.closest(".nav-item");
  if (!btn) return;
  state.currentView = btn.dataset.view;
  render();
});

document.getElementById("premiumBtn").addEventListener("click", () => {
  alert("Próximamente: TrainLab Premium (planificación avanzada, analíticas pro y exportaciones).");
});

// ====== Init ======
loadState();
if (!state.user) state.currentView = "onboarding";
render();
