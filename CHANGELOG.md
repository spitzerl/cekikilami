# Changelog

Toutes les évolutions notables de Cékikilami sont documentées ici.
Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le versioning sémantique.

## [1.0.0-beta.2] — 2026-11-24

### Modifié

- Menu pause réorganisé pour être plus rapide à utiliser : accès direct aux joueurs, réglages groupés, actions d’hôte clairement séparées et bouton « Reprendre la partie » toujours accessible.
- Sur mobile, le menu s’ouvre désormais comme une feuille en bas de l’écran, avec un défilement interne et une zone d’action fixe.
- Le menu affiche le temps restant et le sous-état de la manche (écoute, vote ou révélation).
- Navigation clavier renforcée : focus conservé dans le menu, retour au menu avec Échap depuis la liste des joueurs et focus restauré à la fermeture.

### Corrigé

- Le menu pause passe au-dessus des notifications et son en-tête n’est plus masqué.
- La copie du code du salon affiche un retour visuel sans décaler les éléments du menu.

## [1.0.0-beta.1] — 2026-11-23

Première bêta publique, proche de la release `1.0.0`.

### Ajouté

- Trois modes de points : Détective, Équilibré et Bluff.
- Choix du moment de révélation du titre, de l’artiste et de la pochette : avant le vote, après le vote ou aux résultats.
- Blind test avec compte à rebours et réponse modifiable jusqu’à la fin du chrono.
- Option pour masquer le scoreboard pendant la partie.
- Export du classement en image, avec les avatars des joueurs et sans URL de pied de page.
- Endpoint de version (`GET /api/version`) et version dans `/health`.

### Modifié

- Le scoreboard n’expose que les scores des manches terminées pour éviter toute fuite pendant le vote.
- Le disque de la phase d’écoute est animé pendant la lecture ; les barres d’égaliseur ont été retirées.
- Les scores incluent le bluff du proposeur et les rangs partagés.
- La liste des musiques utilise les nouveaux CDN Deezer et met les extraits en cache local.

### Corrigé

- Les extraits audio ne déclenchent plus de faux message d’erreur après un changement de piste ou un blocage d’autoplay.
- La mémoire des parties et les réponses du blind test restent masquées jusqu’à la révélation.
