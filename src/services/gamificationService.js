// Definición de las Medallas (Iconos de Ionicons)
export const BADGES = [
    {
        id: 'first_step',
        name: 'Primer Paso',
        description: 'Has creado tu primer hábito.',
        icon: 'footsteps', // Antes 👟
        color: '#4CD964',
        condition: (stats) => stats.habitsCount >= 1
    },
    {
        id: 'commited',
        name: 'Comprometido',
        description: 'Mantienes 3 o más hábitos activos.',
        icon: 'calendar', // Antes 💍
        color: '#5856D6',
        condition: (stats) => stats.habitsCount >= 3
    },
    {
        id: 'warrior',
        name: 'Guerrero',
        description: 'Participas en tu primer duelo.',
        icon: 'trophy', // Antes ⚔️
        color: '#FFD700',
        condition: (stats) => stats.challengesCount >= 1
    },
    {
        id: 'social',
        name: 'Influencer',
        description: 'Tienes al menos un amigo.',
        icon: 'people', // Antes 🤝
        color: '#FF9500',
        condition: (stats) => stats.friendsCount >= 1
    },
    {
        id: 'fire',
        name: 'En Llamas',
        description: 'Has logrado una racha de 5 días.',
        icon: 'flame', // Antes 🔥
        color: '#FF3B30',
        condition: (stats) => stats.maxStreak >= 5
    },
    {
        id: 'veteran',
        name: 'Veterano',
        description: 'Llevas más de 3 días registrado.',
        icon: 'ribbon', // Antes 🎖️
        color: '#5AC8FA',
        condition: (stats) => stats.daysSinceCreation >= 3
    }
];

const GamificationService = {
    calculateBadges: (userStats) => {
        return BADGES.map(badge => ({
            ...badge,
            unlocked: badge.condition(userStats)
        }));
    }
};

export default GamificationService;