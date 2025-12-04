import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Asegúrate de la arroba @
import { useRef, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const SLIDES = [
    {
        id: '1',
        title: 'Domina tus Hábitos',
        description: 'Crea rutinas diarias, marca tu progreso y construye una disciplina de acero.',
        icon: 'list-circle',
        color: '#4A90E2'
    },
    {
        id: '2',
        title: 'Compite con Amigos',
        description: 'La gamificación real. Reta a tus amigos a duelos 1vs1. ¿Quién mantendrá la racha?',
        icon: 'trophy',
        color: '#FF9500'
    },
    {
        id: '3',
        title: 'Visualiza tu Éxito',
        description: 'Gráficos, calendarios y estadísticas detalladas para que nunca pierdas la motivación.',
        icon: 'stats-chart',
        color: '#34C759'
    }
];

export default function OnboardingScreen({ navigation }) {
    const { width } = useWindowDimensions();
    const { theme } = useTheme();
    const colors = theme.colors; // Extracción segura de colores

    const [currentIndex, setCurrentIndex] = useState(0);
    const slidesRef = useRef(null);

    const handleFinish = async () => {
        try {
            await AsyncStorage.setItem('hasSeenOnboarding', 'true');
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        } catch (e) {
            navigation.navigate('Login');
        }
    };

    const updateCurrentSlideIndex = (e) => {
        const contentOffsetX = e.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / width);
        setCurrentIndex(index);
    };

    const goNext = () => {
        const nextSlideIndex = currentIndex + 1;
        if (nextSlideIndex !== SLIDES.length) {
            const offset = nextSlideIndex * width;
            slidesRef.current.scrollToOffset({ offset });
            setCurrentIndex(nextSlideIndex);
        } else {
            handleFinish();
        }
    };

    const renderItem = ({ item }) => (
        <View style={[styles.slide, { width, backgroundColor: colors.background }]}>
            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={100} color={item.color} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                ref={slidesRef}
                data={SLIDES}
                contentContainerStyle={{ height: '75%' }}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                onMomentumScrollEnd={updateCurrentSlideIndex}
            />

            {/* FOOTER */}
            <View style={[styles.footer, { height: '25%' }]}>

                {/* Puntos Indicadores */}
                <View style={styles.indicatorContainer}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.indicator,
                                currentIndex === index
                                    ? { backgroundColor: colors.primary, width: 25 }
                                    : { backgroundColor: colors.border }
                            ]}
                        />
                    ))}
                </View>

                {/* BOTONES DE ACCIÓN */}
                <View style={{ marginBottom: 50, paddingHorizontal: 20 }}>
                    {currentIndex === SLIDES.length - 1 ? (
                        // --- BOTÓN DE EMPEZAR (SOLO ÚLTIMA PAGINA) ---
                        <TouchableOpacity
                            style={[styles.btn, styles.btnFull, { backgroundColor: colors.primary }]}
                            onPress={handleFinish}
                        >
                            <Text style={styles.btnText}>¡EMPEZAR!</Text>
                        </TouchableOpacity>
                    ) : (
                        // --- BOTONES DE SALTAR / SIGUIENTE ---
                        <View style={{ flexDirection: 'row', gap: 20 }}>
                            <TouchableOpacity
                                style={[styles.btn, styles.btnFlex, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
                                onPress={handleFinish}
                            >
                                <Text style={[styles.btnText, { color: colors.textSecondary }]}>SALTAR</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.btn, styles.btnFlex, { backgroundColor: colors.primary }]}
                                onPress={goNext}
                            >
                                <Text style={styles.btnText}>SIGUIENTE</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    slide: { alignItems: 'center', justifyContent: 'center', padding: 20 },
    iconContainer: { width: 200, height: 200, borderRadius: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
    title: { fontSize: 28, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
    description: { fontSize: 16, marginTop: 10, textAlign: 'center', maxWidth: '80%', lineHeight: 24 },
    footer: { justifyContent: 'space-between' },
    indicatorContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    indicator: { height: 8, width: 8, borderRadius: 4, marginHorizontal: 3 },

    // ESTILOS DE BOTONES CORREGIDOS
    btn: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    btnFlex: { flex: 1 }, // Para cuando hay dos botones
    btnFull: { width: '100%' }, // Para cuando hay solo uno (IMPORTANTE)

    btnText: { fontWeight: 'bold', fontSize: 15, color: '#fff' },
});