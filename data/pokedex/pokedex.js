(function () {
  "use strict";

  const DATA_URL = "https://cdn.jsdelivr.net/gh/webcerise/pokemon-solstice-data@main/data/pokedex";
  const $ = (selector, root) => (root || document).querySelector(selector);
  const elements = {
    search: $("#solstice-dex-search"),
    type: $("#solstice-dex-type"),
    rarity: $("#solstice-dex-rarity"),
    size: $("#solstice-dex-size"),
    disabled: $("#solstice-dex-disabled"),
    reset: $("#solstice-dex-reset"),
    count: $("#solstice-dex-count"),
    status: $("#solstice-dex-status"),
    grid: $("#solstice-dex-grid"),
    modal: $("#solstice-dex-modal"),
    detail: $("#solstice-dex-detail"),
    close: $("#solstice-dex-close")
  };

  if (!elements.grid) return;

  const state = { pokemon: [], moves: new Map(), skills: new Map(), passives: new Map() };
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  };
  const unique = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"));

  function option(select, value) {
    const item = node("option", "", value);
    item.value = value;
    select.appendChild(item);
  }

  function typeClass(type) {
    return `type-${normalize(type).replace(/[^a-z0-9]+/g, "-")}`;
  }

  function addTypes(parent, types) {
    const wrap = node("div", "solstice-dex-types");
    types.forEach((type) => wrap.appendChild(node("span", typeClass(type), type)));
    parent.appendChild(wrap);
  }

  function setStatus(icon, message, isError) {
    elements.status.hidden = false;
    elements.status.classList.toggle("is-error", Boolean(isError));
    elements.status.innerHTML = "";
    elements.status.appendChild(node("i", icon));
    elements.status.appendChild(node("p", "", message));
  }

  function populateFilters() {
    unique(state.pokemon.flatMap((pokemon) => pokemon.types)).forEach((value) => option(elements.type, value));
    unique(state.pokemon.map((pokemon) => pokemon.rarity)).forEach((value) => option(elements.rarity, value));
    unique(state.pokemon.map((pokemon) => pokemon.size)).forEach((value) => option(elements.size, value));
  }

  function matches(pokemon) {
    const query = normalize(elements.search.value);
    const searchable = normalize(`${pokemon.id} ${pokemon.name.fr} ${pokemon.name.en}`);
    return (!query || searchable.includes(query)) &&
      (!elements.type.value || pokemon.types.includes(elements.type.value)) &&
      (!elements.rarity.value || pokemon.rarity === elements.rarity.value) &&
      (!elements.size.value || pokemon.size === elements.size.value) &&
      (elements.disabled.checked || pokemon.enabled);
  }

  function pokemonCard(pokemon) {
    const card = node("button", "solstice-dex-card");
    card.type = "button";
    card.dataset.id = pokemon.id;
    if (!pokemon.enabled) card.classList.add("is-disabled");

    const visual = node("div", "solstice-dex-card-visual");
    visual.appendChild(node("span", "solstice-dex-number", `N° ${String(pokemon.id).padStart(3, "0")}`));
    const image = node("img");
    image.src = pokemon.sprite;
    image.alt = pokemon.name.fr;
    image.loading = "lazy";
    visual.appendChild(image);

    const copy = node("div", "solstice-dex-card-copy");
    copy.appendChild(node("h2", "", pokemon.name.fr));
    copy.appendChild(node("p", "", pokemon.name.en));
    addTypes(copy, pokemon.types);
    const meta = node("div", "solstice-dex-card-meta");
    meta.appendChild(node("span", "", pokemon.rarity || "Rareté inconnue"));
    meta.appendChild(node("span", "", pokemon.size || "Taille inconnue"));
    copy.appendChild(meta);

    card.append(visual, copy);
    card.addEventListener("click", () => openPokemon(pokemon));
    return card;
  }

  function render() {
    const filtered = state.pokemon.filter(matches).sort((a, b) => a.id - b.id);
    elements.grid.innerHTML = "";
    elements.count.textContent = `${filtered.length} Pokémon`;
    if (!filtered.length) {
      setStatus("ph ph-magnifying-glass", "Aucun Pokémon ne correspond à ces filtres.");
      return;
    }
    elements.status.hidden = true;
    const fragment = document.createDocumentFragment();
    filtered.forEach((pokemon) => fragment.appendChild(pokemonCard(pokemon)));
    elements.grid.appendChild(fragment);
  }

  function statLabel(key) {
    return { hp: "PV", attack: "Attaque", specialAttack: "Attaque spéciale", defense: "Défense", specialDefense: "Défense spéciale", speed: "Vitesse" }[key];
  }

  function addStats(parent, stats) {
    const section = node("section", "solstice-dex-detail-section solstice-dex-stats");
    section.appendChild(node("h3", "", "Statistiques"));
    const grid = node("div", "solstice-dex-stat-grid");
    Object.entries(stats).forEach(([key, value]) => {
      if (value === null) return;
      const item = node("div", "solstice-dex-stat");
      const label = node("div");
      label.append(node("span", "", statLabel(key)), node("strong", "", value));
      const track = node("span", "solstice-dex-stat-track");
      const fill = node("i");
      fill.style.width = `${Math.min(100, value / (key === "hp" ? 1.5 : 0.2))}%`;
      track.appendChild(fill);
      item.append(label, track);
      grid.appendChild(item);
    });
    section.appendChild(grid);
    parent.appendChild(section);
  }

  function linkedSection(parent, title, icon, ids, lookup, kind) {
    const section = node("section", `solstice-dex-detail-section solstice-dex-linked ${kind}`);
    const heading = node("h3");
    heading.append(node("i", icon), document.createTextNode(title));
    section.appendChild(heading);
    const list = node("div", "solstice-dex-linked-list");
    ids.forEach((id) => {
      const entry = lookup.get(id);
      if (!entry) return;
      const details = node("details");
      const summary = node("summary");
      summary.append(node("strong", "", entry.name.fr), node("small", "", entry.name.en));
      details.appendChild(summary);
      const description = entry.description?.fr || entry.effect?.fr;
      if (description) details.appendChild(node("p", "", description));
      if (kind === "moves") {
        const tags = node("div", "solstice-dex-move-tags");
        [entry.type.fr, entry.category.fr, entry.damage.formula, entry.range.fr].filter(Boolean).forEach((value) => tags.appendChild(node("span", "", value)));
        details.appendChild(tags);
      }
      if (entry.incomplete) details.appendChild(node("em", "", "Informations détaillées à compléter."));
      list.appendChild(details);
    });
    if (!list.children.length) list.appendChild(node("p", "solstice-dex-muted", "Aucune information renseignée."));
    section.appendChild(list);
    parent.appendChild(section);
  }

  function evolutionText(evolution) {
    if (!evolution) return "Aucune condition d’évolution renseignée.";
    if (evolution.method === "level") return `Évolution au niveau ${evolution.requirement}${evolution.trainerLevel ? ` — dresseur niveau ${evolution.trainerLevel}` : ""}.`;
    if (evolution.method === "trade") return `Évolution avec : ${evolution.requirement}.`;
    return `Évolution avec : ${evolution.requirement}.`;
  }

  function openPokemon(pokemon) {
    elements.detail.innerHTML = "";
    const hero = node("header", "solstice-dex-sheet-hero");
    const image = node("img");
    image.src = pokemon.sprite;
    image.alt = pokemon.name.fr;
    const copy = node("div");
    copy.appendChild(node("span", "", `N° ${String(pokemon.id).padStart(3, "0")}`));
    copy.appendChild(node("h2", "", pokemon.name.fr));
    copy.querySelector("h2").id = "solstice-dex-sheet-name";
    copy.appendChild(node("p", "", pokemon.name.en));
    addTypes(copy, pokemon.types);
    hero.append(image, copy);
    elements.detail.appendChild(hero);

    const facts = node("section", "solstice-dex-facts");
    [["ph-fill ph-star", "Rareté", pokemon.rarity], ["ph-fill ph-arrows-out", "Taille", pokemon.size], ["ph-fill ph-scales", "Poids", pokemon.weight], ["ph-fill ph-egg", "Groupe", pokemon.eggGroups.join(", ")]].forEach(([icon, label, value]) => {
      const fact = node("div");
      fact.append(node("i", icon), node("span", "", label), node("strong", "", value || "Non renseigné"));
      facts.appendChild(fact);
    });
    elements.detail.appendChild(facts);
    addStats(elements.detail, pokemon.stats);

    const info = node("section", "solstice-dex-detail-section solstice-dex-notes");
    info.appendChild(node("h3", "", "Évolution et reproduction"));
    info.appendChild(node("p", "", evolutionText(pokemon.evolution)));
    const gender = pokemon.gender.genderless ? "Asexué" : pokemon.gender.femaleRate === null ? "Répartition inconnue" : `${pokemon.gender.femaleRate} % de femelles`;
    info.appendChild(node("p", "", gender));
    if (!pokemon.enabled) info.appendChild(node("div", "solstice-dex-warning", "Cette espèce n’est actuellement pas disponible."));
    elements.detail.appendChild(info);

    linkedSection(elements.detail, "Compétences", "ph-fill ph-sparkle", pokemon.skillIds, state.skills, "skills");
    linkedSection(elements.detail, "Passifs", "ph-fill ph-shield-check", pokemon.passiveIds, state.passives, "passives");
    linkedSection(elements.detail, "Capacités", "ph-fill ph-lightning", pokemon.moveIds, state.moves, "moves");

    elements.modal.classList.add("is-open");
    elements.modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("solstice-dex-lock");
    history.replaceState(null, "", `#pokemon-${pokemon.id}`);
    elements.close.focus();
  }

  function closePokemon() {
    elements.modal.classList.remove("is-open");
    elements.modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("solstice-dex-lock");
    if (/^#pokemon-\d+$/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
  }

  function bind() {
    let timer;
    elements.search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(render, 120); });
    [elements.type, elements.rarity, elements.size, elements.disabled].forEach((element) => element.addEventListener("change", render));
    elements.reset.addEventListener("click", () => {
      elements.search.value = "";
      elements.type.value = "";
      elements.rarity.value = "";
      elements.size.value = "";
      elements.disabled.checked = false;
      render();
    });
    elements.close.addEventListener("click", closePokemon);
    $(".solstice-dex-backdrop").addEventListener("click", closePokemon);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && elements.modal.classList.contains("is-open")) closePokemon(); });
  }

  async function load() {
    try {
      const names = ["pokemon", "moves", "skills", "passives"];
      const responses = await Promise.all(names.map((name) => fetch(`${DATA_URL}/${name}.json`)));
      if (responses.some((response) => !response.ok)) throw new Error("Impossible de charger les fichiers du Pokédex.");
      const [pokemon, moves, skills, passives] = await Promise.all(responses.map((response) => response.json()));
      state.pokemon = pokemon;
      state.moves = new Map(moves.map((entry) => [entry.id, entry]));
      state.skills = new Map(skills.map((entry) => [entry.id, entry]));
      state.passives = new Map(passives.map((entry) => [entry.id, entry]));
      populateFilters();
      bind();
      render();
      const match = location.hash.match(/^#pokemon-(\d+)$/);
      if (match) {
        const selected = state.pokemon.find((entry) => entry.id === Number(match[1]));
        if (selected) openPokemon(selected);
      }
    } catch (error) {
      console.error(error);
      elements.count.textContent = "Pokédex indisponible";
      setStatus("ph ph-warning-circle", "Les données n’ont pas pu être chargées. Vérifiez les fichiers GitHub puis réessayez.", true);
    }
  }

  load();
}());
