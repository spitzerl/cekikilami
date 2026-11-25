# Changelog

Toutes les évolutions notables de Cékikilami sont documentées ici.
Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le versioning sémantique.

## [1.0.0-beta.16] — 2026-11-25

### Corrigé

- Le chrono en urgence n’affiche plus de bande de fond décalée dans sa pilule : les segments occupent toute la hauteur de la barre d’état et le rouge reste porté par l’icône et le temps.

## [1.0.0-beta.15] — 2026-11-25

### Modifié

- Les informations de révélation (proposé par, statut du vote et blind test) sont regroupées dans une seule carte meta avec filet interne, au lieu de deux encadrés séparés.

## [1.0.0-beta.14] — 2026-11-25

### Modifié

- Les encadrés de la révélation (proposé par, statut du vote, blind test) reprennent la surface vitrée, la bordure et les pastilles du reste de l’interface : nom en clair, couleurs sémantiques conservées sans aplat, petit point d’état.

## [1.0.0-beta.13] — 2026-11-25

### Modifié

- La barre de progression de l’en-tête occupe toute la largeur disponible et adopte un rendu néon : segments passés cyan, étape courante en dégradé cyan → violet avec halo.
- L’état « prêts » de la barre d’état n’a plus de fond plein : la couleur verte reste portée par le texte et le point, sans bloc visuel dans la pilule.
- La teinte rouge du chrono urgent se fond désormais en dégradé au lieu d’un aplat.

## [1.0.0-beta.12] — 2026-11-25

### Modifié

- L’en-tête des pages de partie (salon, sélection, écoute & vote, résultats) est plus compact et homogène : titre, sous-titre et actions partagent une même grille, et le chrono rejoint la barre d’état segmentée de la sélection.
- Les actions de l’en-tête s’empilent en pleine largeur sur mobile ; le code du salon passe sur une ligne dédiée sur les très petits écrans.
- Le sous-titre de la sélection est raccourci pour tenir sur une ligne.

## [1.0.0-beta.11] — 2026-11-25

### Modifié

- La barre d’état de la sélection aligne le chrono, les morceaux envoyés et les joueurs prêts dans des pastilles de même forme : compteurs mis en avant, état « prêts » en vert et bouton « Passer au vote » désactivé plus discret.

## [1.0.0-beta.10] — 2026-11-24

### Ajouté

- L’export des résultats propose désormais une variante claire et une variante sombre, avec un aperçu et un nom de fichier distincts.
- L’affichage du code du salon permet de copier séparément le code ou le lien d’invitation, et le menu pause réutilise le même composant.
- La sélection affiche en permanence le nombre de morceaux envoyés et le nombre de joueurs prêts.

### Corrigé

- Le timer n’est plus affiché deux fois pendant la phase d’écoute et de vote.
- Les pochettes des morceaux sont normalisées en HTTPS et les anciennes URLs non valides sont remplacées par l’icône de secours, y compris sur une page servie en HTTPS.
- Le bouton de révélation conserve le total des votes même lorsque l’affichage des votes en direct est désactivé.
- Les bots votent dès l’ouverture du scrutin, ce qui permet à l’hôte de passer la manche sans attendre leur délai aléatoire.

### Modifié

- Le service worker n’intercepte plus les images et ressources servies par un autre domaine.

## [1.0.0-beta.9] — 2026-11-24

### Corrigé

- Les bots restent considérés en ligne après un redémarrage du serveur et continuent de voter normalement.
- Une reconnexion rapide ne peut plus laisser un joueur marqué hors ligne ni transférer le rôle d’hôte à tort.
- Les reconnexions légitimes ne sont plus bloquées par la limite de connexions Socket.IO : seuls les échecs d’authentification sont limités strictement.
- Une session avec au moins un joueur connecté reste active, y compris sur l’écran des résultats, grâce à un battement de cœur périodique.
- Le délai avant transfert du rôle d’hôte passe à 30 s pour absorber les micro-coupures réseau et les verrouillages d’écran.
- Si la session ou le jeton n’existe plus, le joueur est renvoyé proprement à l’accueil au lieu de rester bloqué sur une page figée.

## [1.0.0-beta.8] — 2026-11-24

### Ajouté

- Un joueur qui ferme l’onglet ou recharge la page peut désormais reprendre sa partie depuis l’accueil : sa session active est retrouvée à partir de son jeton, avec un accès direct à la phase en cours (salon, sélection, vote ou résultats).

### Corrigé

- Un joueur déconnecté au moment du lancement du vote n’est plus définitivement rétrogradé en observateur s’il avait proposé ses morceaux : il peut revenir et voter comme les autres.
- Un hôte seul dans le salon d’attente qui ferme son onglet conserve désormais son salon au lieu de le voir supprimé immédiatement. Un départ volontaire continue de nettoyer le salon vide.

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
