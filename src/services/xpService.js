// TABLA DE NIVELES
export const LEVELS = [
    { level: 1, xp: 0, title: "Novato", color: "#B0BEC5" },
    { level: 2, xp: 100, title: "Iniciado", color: "#90A4AE" },
    { level: 3, xp: 300, title: "Aprendiz", color: "#78909C" },
    { level: 4, xp: 600, title: "Explorador", color: "#607D8B" },
    { level: 5, xp: 1000, title: "Constante", color: "#4DB6AC" },
    { level: 10, xp: 2500, title: "Disciplinado", color: "#009688" },
    { level: 20, xp: 6000, title: "Guerrero", color: "#42A5F5" },
    { level: 30, xp: 12000, title: "Veterano", color: "#1565C0" },
    { level: 40, xp: 25000, title: "Maestro", color: "#7E57C2" },
    { level: 50, xp: 50000, title: "LEYENDA", color: "#FFD700" }
];

// --- CAMBIO AQUÍ: Exportamos la función directamente con 'export const' ---
export const getLevelInfo = (totalXP = 0) => {
    let currentLevelObj = LEVELS[0];
    let nextLevelObj = LEVELS[1];

    for (let i = 0; i < LEVELS.length; i++) {
        if (totalXP >= LEVELS[i].xp) {
            currentLevelObj = LEVELS[i];
            nextLevelObj = LEVELS[i + 1] || null;
        } else {
            break;
        }
    }

    let progress = 1;
    let xpNeeded = 0;

    if (nextLevelObj) {
        const xpRange = nextLevelObj.xp - currentLevelObj.xp;
        const xpEarnedInRank = totalXP - currentLevelObj.xp;
        progress = xpEarnedInRank / xpRange;
        xpNeeded = nextLevelObj.xp - totalXP;
    }

    return {
        level: currentLevelObj.level,
        title: currentLevelObj.title,
        color: currentLevelObj.color,
        currentXP: totalXP,
        nextLevelXP: nextLevelObj ? nextLevelObj.xp : totalXP,
        progress,
        xpNeeded
    };
};