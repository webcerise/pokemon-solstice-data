(function () {
  "use strict";

  const scriptVersion = document.currentScript?.src.match(/pokemon-solstice-data@([^/]+)/)?.[1] || "main";
  const DATA_URL = `https://cdn.jsdelivr.net/gh/webcerise/pokemon-solstice-data@${scriptVersion}/data/pokedex`;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const el = (tag, className, text) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined && text !== null) item.textContent = text;
    return item;
  };
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const unique = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"));
  const root = $(".solstice-pokedex");
  if (!root) return;

  const ui = {
    tabs: $$("[data-pokedex-tab]", root), panels: $$("[data-pokedex-panel]", root),
    search: $("#solstice-pokedex-search"), type: $("#solstice-pokedex-type"), rarity: $("#solstice-pokedex-rarity"), size: $("#solstice-pokedex-size"),
    disabled: $("#solstice-pokedex-disabled"), reset: $("#solstice-pokedex-reset"), count: $("#solstice-pokedex-count"),
    grid: $("#solstice-pokedex-grid"), status: $("#solstice-pokedex-status"), moveType: $("#solstice-pokedex-move-type"),
    modal: $("#solstice-pokedex-modal"), detail: $("#solstice-pokedex-detail"), close: $("#solstice-pokedex-close")
  };
  const state = {
    pokemon: [], byId: new Map(), skills: [], passives: [], moves: [], maps: {}, users: {},
    pages: { pokemon: 1, skills: 1, passives: 1, moves: 1 },
    perPage: { pokemon: 12, skills: 10, passives: 10, moves: 10 }
  };

  function option(select, value) {
    const item = el("option", "", value); item.value = value; select.appendChild(item);
  }

  function typeClass(type) {
    return `type-${normalize(type).replace(/[^a-z0-9]+/g, "-")}`;
  }

  function types(parent, values) {
    const wrap = el("div", "solstice-pokedex-types");
    values.forEach((value) => wrap.appendChild(el("span", typeClass(value), value)));
    parent.appendChild(wrap);
  }

  function sprite(pokemon, className) {
    const image = el("img", className || "");
    image.src = pokemon.sprite; image.alt = pokemon.name.fr; image.loading = "lazy"; image.width = 96; image.height = 96;
    return image;
  }

  function activateTab(name) {
    ui.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.pokedexTab === name));
    ui.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.pokedexPanel === name));
    const top = root.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function populateFilters() {
    unique(state.pokemon.flatMap((pokemon) => pokemon.types)).forEach((value) => { option(ui.type, value); option(ui.moveType, value); });
    unique(state.pokemon.map((pokemon) => pokemon.rarity)).forEach((value) => option(ui.rarity, value));
    unique(state.pokemon.map((pokemon) => pokemon.size)).forEach((value) => option(ui.size, value));
  }

  function showStatus(message, error) {
    ui.status.hidden = false; ui.status.classList.toggle("is-error", Boolean(error)); ui.status.innerHTML = "";
    ui.status.append(el("i", error ? "ph ph-warning-circle" : "ph ph-spinner-gap"), el("p", "", message));
  }

  function pokemonMatches(pokemon) {
    const query = normalize(ui.search.value);
    return (!query || normalize(`${pokemon.id} ${pokemon.name.fr} ${pokemon.name.en} ${(pokemon.locations || []).join(" ")}`).includes(query)) &&
      (!ui.type.value || pokemon.types.includes(ui.type.value)) && (!ui.rarity.value || pokemon.rarity === ui.rarity.value) &&
      (!ui.size.value || pokemon.size === ui.size.value) && (ui.disabled.checked || pokemon.enabled);
  }

  function pokemonCard(pokemon) {
    const card = el("button", `solstice-pokedex-card${pokemon.enabled ? "" : " is-disabled"}`); card.type = "button";
    const visual = el("div", "solstice-pokedex-card-image");
    visual.append(el("span", "", `N° ${String(pokemon.id).padStart(3, "0")}`), sprite(pokemon));
    const copy = el("div", "solstice-pokedex-card-copy");
    copy.append(el("h2", "", pokemon.name.fr), el("p", "", pokemon.name.en)); types(copy, pokemon.types);
    const meta = el("div", "solstice-pokedex-card-meta"); meta.append(el("span", "", pokemon.rarity), el("span", "", pokemon.size)); copy.appendChild(meta);
    card.append(visual, copy); card.addEventListener("click", () => openPokemon(pokemon)); return card;
  }

  function renderPagination(kind, total, callback) {
    const container = $(`[data-pagination="${kind}"]`, root);
    const pageCount = Math.max(1, Math.ceil(total / state.perPage[kind]));
    state.pages[kind] = Math.min(Math.max(1, state.pages[kind]), pageCount);
    container.innerHTML = "";
    if (pageCount <= 1) { container.hidden = true; return; }
    container.hidden = false;

    const changePage = (page) => {
      state.pages[kind] = page; callback();
      const panel = $(`[data-pokedex-panel="${kind === "pokemon" ? "pokemon" : kind}"]`, root);
      const top = panel.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: "smooth" });
    };
    const button = (content, page, label, active, disabled) => {
      const item = el("button", active ? "active" : ""); item.type = "button"; item.disabled = Boolean(disabled); item.setAttribute("aria-label", label); item.setAttribute("aria-current", active ? "page" : "false");
      if (content.startsWith("ph ")) item.appendChild(el("i", content)); else item.textContent = content;
      item.addEventListener("click", () => changePage(page)); container.appendChild(item);
    };
    const current = state.pages[kind];
    button("ph ph-caret-left", current - 1, "Page précédente", false, current === 1);
    let start = Math.max(1, current - 2); let end = Math.min(pageCount, start + 4); start = Math.max(1, end - 4);
    if (start > 1) { button("1", 1, "Page 1", current === 1); if (start > 2) container.appendChild(el("span", "", "…")); }
    for (let page = start; page <= end; page += 1) button(String(page), page, `Page ${page}`, page === current);
    if (end < pageCount) { if (end < pageCount - 1) container.appendChild(el("span", "", "…")); button(String(pageCount), pageCount, `Page ${pageCount}`, current === pageCount); }
    button("ph ph-caret-right", current + 1, "Page suivante", false, current === pageCount);
  }

  function renderPokemon() {
    const result = state.pokemon.filter(pokemonMatches).sort((a, b) => a.id - b.id);
    const pageCount = Math.max(1, Math.ceil(result.length / state.perPage.pokemon)); state.pages.pokemon = Math.min(state.pages.pokemon, pageCount);
    const start = (state.pages.pokemon - 1) * state.perPage.pokemon; const visible = result.slice(start, start + state.perPage.pokemon);
    ui.grid.innerHTML = ""; ui.count.textContent = `${result.length} Pokémon — page ${state.pages.pokemon} sur ${pageCount}`;
    if (!result.length) { showStatus("Aucun Pokémon ne correspond à ces filtres."); renderPagination("pokemon", 0, renderPokemon); return; }
    ui.status.hidden = true;
    const fragment = document.createDocumentFragment(); visible.forEach((pokemon) => fragment.appendChild(pokemonCard(pokemon))); ui.grid.appendChild(fragment);
    renderPagination("pokemon", result.length, renderPokemon);
  }

  function buildUsage(kind, key) {
    const usage = new Map();
    state.pokemon.forEach((pokemon) => pokemon[key].forEach((id) => {
      if (!usage.has(id)) usage.set(id, []); usage.get(id).push(pokemon);
    }));
    state.users[kind] = usage;
  }

  function pokemonUsers(entries) {
    const wrap = el("div", "solstice-pokedex-users");
    if (!entries.length) { wrap.appendChild(el("p", "solstice-pokedex-muted", "Aucun Pokémon renseigné.")); return wrap; }
    entries.sort((a, b) => a.id - b.id).forEach((pokemon) => {
      const button = el("button", pokemon.enabled ? "" : "is-disabled"); button.type = "button"; button.title = pokemon.name.fr;
      button.append(sprite(pokemon), el("span", "", pokemon.name.fr)); button.addEventListener("click", () => openPokemon(pokemon)); wrap.appendChild(button);
    });
    return wrap;
  }

  function directoryCard(entry, kind) {
    const card = el("details", "solstice-pokedex-reference");
    const summary = el("summary");
    const title = el("div"); title.append(el("h2", "", entry.name.fr), el("p", "", entry.name.en));
    const users = state.users[kind].get(entry.id) || [];
    summary.append(title, el("span", "solstice-pokedex-reference-count", `${users.length} Pokémon`), el("i", "ph ph-caret-down")); card.appendChild(summary);
    const body = el("div", "solstice-pokedex-reference-body");
    const description = entry.description?.fr || entry.effect?.fr;
    if (description) body.appendChild(el("p", "solstice-pokedex-reference-description", description));
    if (kind === "moves") {
      const tags = el("div", "solstice-pokedex-reference-tags");
      [entry.type.fr, entry.category.fr, entry.damage.formula, entry.range.fr, entry.frequency.perCombat ? `${entry.frequency.perCombat} / combat` : null].filter(Boolean).forEach((value) => tags.appendChild(el("span", "", value)));
      body.appendChild(tags);
    }
    if (entry.incomplete) body.appendChild(el("div", "solstice-pokedex-incomplete", "Certaines informations restent à compléter dans la base de données."));
    const heading = el("h3", "", "Pokémon concernés"); body.append(heading, pokemonUsers(users)); card.appendChild(body); return card;
  }

  function renderDirectory(kind) {
    const container = $(`[data-directory="${kind}"]`, root);
    const input = $(`[data-directory-search="${kind}"]`, root);
    const query = normalize(input.value);
    const type = kind === "moves" ? ui.moveType.value : "";
    const entries = state[kind].filter((entry) => {
      const users = state.users[kind].get(entry.id) || [];
      const haystack = normalize(`${entry.name.fr} ${entry.name.en} ${entry.description?.fr || entry.effect?.fr || ""} ${users.map((pokemon) => pokemon.name.fr).join(" ")}`);
      return (!query || haystack.includes(query)) && (!type || entry.type.fr === type);
    }).sort((a, b) => a.name.fr.localeCompare(b.name.fr, "fr"));
    const pageCount = Math.max(1, Math.ceil(entries.length / state.perPage[kind])); state.pages[kind] = Math.min(state.pages[kind], pageCount);
    const start = (state.pages[kind] - 1) * state.perPage[kind]; const visible = entries.slice(start, start + state.perPage[kind]);
    container.innerHTML = ""; $(`[data-directory-count="${kind}"]`, root).textContent = `${entries.length} entrées — page ${state.pages[kind]} sur ${pageCount}`;
    if (!entries.length) { container.appendChild(el("div", "solstice-pokedex-empty", "Aucun résultat.")); renderPagination(kind, 0, () => renderDirectory(kind)); return; }
    const fragment = document.createDocumentFragment(); visible.forEach((entry) => fragment.appendChild(directoryCard(entry, kind))); container.appendChild(fragment);
    renderPagination(kind, entries.length, () => renderDirectory(kind));
  }

  function statName(key) {
    return { hp: "PV", attack: "Attaque", specialAttack: "Attaque spéciale", defense: "Défense", specialDefense: "Défense spéciale", speed: "Vitesse" }[key];
  }

  function linkedDetail(title, ids, map, kind) {
    const section = el("section", "solstice-pokedex-detail-section"); section.appendChild(el("h3", "", title));
    const list = el("div", "solstice-pokedex-detail-list");
    const icons = { skills: "ph-fill ph-sparkle", passives: "ph-fill ph-shield-check", moves: "ph-fill ph-lightning" };
    ids.forEach((id) => {
      const entry = map.get(id); if (!entry) return;
      const card = el("article", `solstice-pokedex-detail-card ${kind}`);
      const header = el("header"); header.appendChild(el("i", icons[kind]));
      const names = el("div"); names.append(el("h4", "", entry.name.fr), el("span", "", entry.name.en)); header.appendChild(names); card.appendChild(header);
      const description = entry.description?.fr || entry.effect?.fr;
      card.appendChild(el("p", "", description || "Description à compléter."));
      if (kind === "moves") {
        const tags = el("div", "solstice-pokedex-detail-tags");
        [entry.type.fr, entry.category.fr, entry.damage.formula, entry.frequency.perCombat ? `${entry.frequency.perCombat} / combat` : null].filter(Boolean).forEach((value) => tags.appendChild(el("span", "", value)));
        card.appendChild(tags);
      }
      list.appendChild(card);
    });
    if (!list.children.length) list.appendChild(el("p", "solstice-pokedex-muted", "Aucune information renseignée.")); section.appendChild(list); return section;
  }

  function openPokemon(pokemon) {
    ui.detail.innerHTML = "";
    const hero = el("header", "solstice-pokedex-sheet-hero"); const copy = el("div");
    copy.append(el("span", "", `N° ${String(pokemon.id).padStart(3, "0")}`), el("h2", "", pokemon.name.fr), el("p", "", pokemon.name.en)); copy.querySelector("h2").id = "solstice-pokedex-sheet-name"; types(copy, pokemon.types); hero.append(sprite(pokemon), copy); ui.detail.appendChild(hero);
    const facts = el("div", "solstice-pokedex-facts"); [["Rareté", pokemon.rarity], ["Taille", pokemon.size], ["Poids", pokemon.weight], ["Groupe", pokemon.eggGroups.join(", ")]].forEach(([label, value]) => { const item = el("div"); item.append(el("span", "", label), el("strong", "", value || "Non renseigné")); facts.appendChild(item); }); ui.detail.appendChild(facts);
    const stats = el("section", "solstice-pokedex-detail-section"); stats.appendChild(el("h3", "", "Statistiques")); const statGrid = el("div", "solstice-pokedex-stats"); Object.entries(pokemon.stats).forEach(([key, value]) => { if (value === null) return; const item = el("div"); item.append(el("span", "", statName(key)), el("strong", "", value)); statGrid.appendChild(item); }); stats.appendChild(statGrid); ui.detail.appendChild(stats);
    const evolution = el("section", "solstice-pokedex-detail-section"); evolution.appendChild(el("h3", "", "Évolution et reproduction")); const trainerLevel = pokemon.evolution?.trainerLevel; const evolutionText = trainerLevel ? `Niveau de dresseur requis : ${trainerLevel}.` : "Aucun niveau de dresseur particulier n’est requis."; evolution.appendChild(el("p", "", evolutionText)); evolution.appendChild(el("p", "", pokemon.gender.genderless ? "Asexué" : pokemon.gender.femaleRate === null ? "Répartition inconnue" : `${pokemon.gender.femaleRate} % de femelles`)); ui.detail.appendChild(evolution);
    const locations = el("section", "solstice-pokedex-detail-section solstice-pokedex-locations"); locations.appendChild(el("h3", "", "Où le trouver ?")); const locationList = el("div"); (pokemon.locations || []).forEach((location) => { const tag = el("span"); tag.append(el("i", "ph-fill ph-map-pin"), document.createTextNode(location)); locationList.appendChild(tag); }); if (!locationList.children.length) locationList.appendChild(el("p", "solstice-pokedex-muted", "Aucune zone de capture renseignée.")); locations.appendChild(locationList); ui.detail.appendChild(locations);
    ui.detail.append(linkedDetail("Compétences", pokemon.skillIds, state.maps.skills, "skills"), linkedDetail("Talents", pokemon.passiveIds, state.maps.passives, "passives"), linkedDetail("Capacités", pokemon.moveIds, state.maps.moves, "moves"));
    ui.modal.classList.add("is-open"); ui.modal.setAttribute("aria-hidden", "false"); document.body.classList.add("solstice-pokedex-lock"); ui.close.focus();
  }

  function closePokemon() { ui.modal.classList.remove("is-open"); ui.modal.setAttribute("aria-hidden", "true"); document.body.classList.remove("solstice-pokedex-lock"); }

  function bind() {
    ui.tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.pokedexTab)));
    let timer; ui.search.addEventListener("input", () => { clearTimeout(timer); state.pages.pokemon = 1; timer = setTimeout(renderPokemon, 100); });
    [ui.type, ui.rarity, ui.size, ui.disabled].forEach((input) => input.addEventListener("change", () => { state.pages.pokemon = 1; renderPokemon(); }));
    ui.reset.addEventListener("click", () => { ui.search.value = ""; ui.type.value = ""; ui.rarity.value = ""; ui.size.value = ""; ui.disabled.checked = false; state.pages.pokemon = 1; renderPokemon(); });
    $$("[data-directory-search]", root).forEach((input) => input.addEventListener("input", () => { const kind = input.dataset.directorySearch; state.pages[kind] = 1; renderDirectory(kind); }));
    ui.moveType.addEventListener("change", () => { state.pages.moves = 1; renderDirectory("moves"); });
    ui.close.addEventListener("click", closePokemon); $(".solstice-pokedex-backdrop", root).addEventListener("click", closePokemon); document.addEventListener("keydown", (event) => { if (event.key === "Escape") closePokemon(); });
  }

  async function load() {
    try {
      const names = ["pokemon", "moves", "skills", "passives"];
      const responses = await Promise.all(names.map((name) => fetch(`${DATA_URL}/${name}.json`)));
      if (responses.some((response) => !response.ok)) throw new Error("Données indisponibles");
      [state.pokemon, state.moves, state.skills, state.passives] = await Promise.all(responses.map((response) => response.json()));
      state.byId = new Map(state.pokemon.map((pokemon) => [pokemon.id, pokemon]));
      ["moves", "skills", "passives"].forEach((kind) => { state.maps[kind] = new Map(state[kind].map((entry) => [entry.id, entry])); });
      buildUsage("skills", "skillIds"); buildUsage("passives", "passiveIds"); buildUsage("moves", "moveIds");
      populateFilters(); bind(); renderPokemon(); renderDirectory("skills"); renderDirectory("passives"); renderDirectory("moves");
    } catch (error) { console.error(error); ui.count.textContent = "Pokédex indisponible"; showStatus("Les données GitHub n’ont pas pu être chargées.", true); }
  }

  load();
}());
