# Changelog

Toutes les évolutions notables de Cékikilami sont documentées ici.
Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le versioning sémantique.

## [1.0.0-beta.8] — 2026-11-24

### Ajouté

- Un joueur qui ferme l’onglet ou recharge la page peut désormais reprendre sa partie depuis l’accueil : sa session active est retrouvée à partir de son jeton, avec un accès direct à la phase en cours (salon, sélection, vote ou résultats).

### Corrigé

- Un joueur déconnecté au moment du lancement du vote n’est plus définitivement rétrogradé en observateur s’il avait proposé ses morceaux : il peut revenir et voter comme les autres.

## [1.0.0-beta.7] — 2026-11-24

### Modifié

- Le logo Cékikilami demande désormais aussi confirmation avant de quitter l’écran des résultats, avec une option pour rester sur les scores.

## [1.0.0-beta.6] — 2026-11-24

### Modifié

- Si l’hôte quitte le salon ou se déconnecte, le rôle d’hôte est désormais transféré automatiquement à un autre joueur, connecté en priorité, après un court délai. Le salon d’attente n’est supprimé que si aucun autre joueur ne peut reprendre la main.

## [1.0.0-beta.5] — 2026-11-24

### Ajouté

- Le logo Cékikilami ouvre désormais la page d’accueil depuis toutes les pages de l’application. Pendant une partie ou dans le salon d’attente, une confirmation propose de rester sur place ou de retourner à l’accueil.

## [1.0.0-beta.4] — 2026-11-24

### Modifié

- Les notifications de connexion sont réduites à l’essentiel : les connexions et déconnexions des autres joueurs ne sont plus annoncées, et une perte de connexion n’est signalée qu’après quelques secondes, sans message lors de la reconnexion.

## [1.0.0-beta.3] — 2026-11-24

### Corrigé

- Le réglage du volume s’applique désormais à tous les extraits musicaux de l’application, y compris ceux de la sélection et de la démo d’accueil.

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
