# Identité de marque

Le nom, la palette et la mascotte sont **provisoires et remplaçables**. Tout part d'un seul
fichier, [brand/brand.json](../../brand/brand.json) ; le reste est généré.

## Changer quelque chose

| Pour changer…       | Modifier                                                        | Puis            |
| ------------------- | --------------------------------------------------------------- | --------------- |
| le nom, le slogan   | `name`, `domain`, `tagline` dans `brand/brand.json`             | `npm run brand` |
| une couleur         | le `hex` voulu dans `colors`                                    | `npm run brand` |
| le nom de mascotte  | `mascotName`                                                    | `npm run brand` |
| le dessin           | remplacer [brand/mascot.template.svg](../../brand/mascot.template.svg) | `npm run brand` |
| les polices         | `fonts`                                                         | `npm run brand` |

`npm run brand` régénère :

- [shared/brand/tokens.css](../../shared/brand/tokens.css) et
  [tokens.ts](../../shared/brand/tokens.ts) — utilisés par le site, l'admin et le desktop ;
- [mascot.svg](mascot.svg) — la mascotte, recolorée avec la palette en cours ;
- [brand-board.html](brand-board.html) — la planche de marque, à ouvrir dans un navigateur.

Ces quatre fichiers ne se modifient jamais à la main.

Vérifier qu'un .com est libre avant de s'attacher à un nom :

```
npm run brand:check -- monidee autreidee
```

« libre » signifie non enregistré au moment du test, pas réservé.

### Ce qui ne dépend pas du nom

Rien dans le code ni sur le serveur ne porte le nom commercial. Le backend lit le nom du produit
dans la variable `APP_NAME`, et l'infrastructure utilise le nom de code fixe `newapp`. Un
changement de nom se résume donc à : `brand.json`, `APP_NAME` sur le serveur, et le domaine.

Dans le gabarit de la mascotte, les couleurs s'écrivent `{{ember}}`, `{{cream}}`, `{{spirit}}`,
`{{foxfire}}`, `{{ink}}`, `{{line}}` : un nouveau dessin qui utilise ces repères suivra la palette.

Les clés de couleur (`ember`, `foxfire`…) sont des identifiants techniques : on change leur
valeur et leur libellé librement, mais pas leur nom.

## Proposition actuelle

**Kitsuvox** = *kitsune* (le renard métamorphe du folklore japonais, qui prend l'apparence et la
voix des humains) + *vox* (la voix). `kitsuvox.com` était non enregistré le 8 octobre 2026.
Autres noms libres à la même date : `kitsuface.com`, `foxmorph.com`.

**Kibi**, la mascotte : un kitsune joueur avec casque-micro et flamme bleue (*kitsunebi*, le feu
de renard). La flamme sert d'indicateur « en direct » dans l'interface.

**Palette** : orange braise en primaire, bleu feu follet en accent, violet pour le Premium, sur
fond nuit. Le texte posé sur l'orange ou le bleu est toujours foncé (le blanc ne passe pas le
contraste AA).

Avant tout lancement sous un nom définitif : recherche d'antériorité de marque (INPI, EUIPO).
