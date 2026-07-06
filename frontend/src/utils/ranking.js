/**
 * Calcule le classement (rank) des joueurs en fonction de leurs scores.
 * Les joueurs ayant le même score reçoivent le même rang (ex: deux 1ers).
 * Si un joueur n'a pas de score (undefined, null, ou 0), son classement est masqué (null).
 * 
 * @param {Array} players - Liste des joueurs
 * @returns {Object} Un objet associant l'ID du joueur à son rang (1-indexed), ou null si aucun classement.
 */
export function getPlayersRankings(players) {
  const rankings = {};
  if (!players || !Array.isArray(players)) return rankings;

  // Filtrer les joueurs actifs (exclure les observateurs)
  const activePlayers = players.filter(p => !p.is_observer);

  for (const player of activePlayers) {
    const score = player.score;
    // Masquer le classement si le score est absent, nul ou non défini
    if (score === undefined || score === null || score === 0) {
      rankings[player.id] = null;
      continue;
    }

    // Le classement standard de compétition est 1 + le nombre de joueurs ayant un score strictement supérieur
    const strictlyBetterCount = activePlayers.filter(other => {
      const otherScore = other.score || 0;
      return other.id !== player.id && !other.is_observer && otherScore > score;
    }).length;

    rankings[player.id] = strictlyBetterCount + 1;
  }

  return rankings;
}
