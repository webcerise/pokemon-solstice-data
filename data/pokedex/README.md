# Données du Pokédex

Déposer ce dossier dans un dépôt GitHub public, par exemple sous `data/pokedex/`.

## Fichiers utilisés par la page

- `index.json` : manifeste et nombre d'entrées.
- `pokemon.json` : Pokémon, statistiques et références vers les autres fichiers.
- `moves.json` : capacités avec noms anglais et français.
- `skills.json` : compétences avec noms et descriptions bilingues.
- `passives.json` : passifs avec noms et descriptions bilingues.
- `pokedex.js` : recherche, filtres, cartes et fiches détaillées de la page Forumactif.

`conversion-report.json` sert uniquement à contrôler la conversion et n'a pas besoin d'être chargé par la page.

## URL GitHub

Après publication, les données peuvent être chargées avec jsDelivr :

```text
https://cdn.jsdelivr.net/gh/UTILISATEUR/DEPOT@main/data/pokedex/index.json
```

Exemple :

```js
const baseUrl = "https://cdn.jsdelivr.net/gh/UTILISATEUR/DEPOT@main/data/pokedex";

const [pokemon, moves, skills, passives] = await Promise.all([
  fetch(`${baseUrl}/pokemon.json`).then(response => response.json()),
  fetch(`${baseUrl}/moves.json`).then(response => response.json()),
  fetch(`${baseUrl}/skills.json`).then(response => response.json()),
  fetch(`${baseUrl}/passives.json`).then(response => response.json())
]);
```

Pour voir une modification immédiatement pendant le développement, l'URL brute GitHub peut être utilisée :

```text
https://raw.githubusercontent.com/UTILISATEUR/DEPOT/main/data/pokedex/pokemon.json
```

jsDelivr est préférable pour le forum, mais son cache peut retarder brièvement l'affichage d'une mise à jour.

## Relations

Les tableaux `skillIds`, `passiveIds` et `moveIds` de chaque Pokémon contiennent les identifiants des entrées correspondantes dans les autres fichiers.

Les sprites sont construits directement avec l'identifiant Pokédex et ne sont pas stockés dans le dépôt.
