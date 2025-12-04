import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';
import ChallengeService from '../../services/challengeService';
import UserService from '../../services/userService';

export default function CreateChallengeScreen({ navigation }) {
    const { theme, isDark } = useTheme();
    const { colors } = theme;
    const user = auth.currentUser;

    // Estados Formulario
    const [challengeName, setChallengeName] = useState('');
    const [duration, setDuration] = useState('7'); // Lo guardamos como string para el Input

    // Estados Selección Amigos
    const [myFriends, setMyFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        const fetchFriends = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const friendIds = userDoc.data().friendList || [];
                    if (friendIds.length > 0) {
                        const details = await UserService.getFriendsDetails(friendIds);
                        setMyFriends(details);
                    }
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchFriends();
    }, []);

    const toggleFriend = (friendId) => {
        if (selectedFriends.includes(friendId)) {
            setSelectedFriends(selectedFriends.filter(id => id !== friendId));
        } else {
            setSelectedFriends([...selectedFriends, friendId]);
        }
    };

    const handleCreate = async () => {
        if (!challengeName.trim()) return Alert.alert("Falta nombre", "Ponle un título épico al reto.");

        // Validación de duración
        const days = parseInt(duration);
        if (isNaN(days) || days <= 0) return Alert.alert("Duración inválida", "El reto debe durar al menos 1 día.");
        if (days > 365) return Alert.alert("¡Wow!", "Máximo 365 días por reto.");

        if (selectedFriends.length === 0) return Alert.alert("Solo no puedes", "Selecciona al menos un amigo.");

        setCreating(true);
        try {
            await ChallengeService.createChallenge(
                user.uid,
                selectedFriends,
                challengeName,
                days // Pasamos el número entero
            );
            Alert.alert("¡Guerra Declarada! ⚔️", `Reto de ${days} días creado.`);
            navigation.goBack();
        } catch (error) {
            Alert.alert("Error", "No se pudo crear el reto.");
        } finally {
            setCreating(false);
        }
    };

    const renderFriendSelect = ({ item }) => {
        const isSelected = selectedFriends.includes(item.id);
        return (
            <TouchableOpacity
                style={[
                    styles.friendRow,
                    { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : 'transparent', borderWidth: 1 }
                ]}
                onPress={() => toggleFriend(item.id)}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.avatar, { backgroundColor: isDark ? '#333' : '#E3F2FD' }]}>
                        <Text style={{ fontSize: 18 }}>{item.avatar?.length > 5 ? '📷' : (item.avatar || item.username[0])}</Text>
                    </View>
                    <Text style={[styles.friendName, { color: colors.text }]}>{item.username}</Text>
                </View>
                <View style={[
                    styles.checkbox,
                    { borderColor: colors.textSecondary, backgroundColor: isSelected ? colors.primary : 'transparent', borderWidth: isSelected ? 0 : 2 }
                ]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>

                <Text style={[styles.label, { color: colors.text }]}>NOMBRE DEL RETO</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
                    placeholder="Ej. Maratón de Lectura..."
                    placeholderTextColor={colors.textSecondary}
                    value={challengeName} onChangeText={setChallengeName}
                />

                {/* --- NUEVA SECCIÓN DE DURACIÓN HÍBRIDA --- */}
                <Text style={[styles.label, { color: colors.text }]}>DURACIÓN (DÍAS)</Text>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                    {/* Input Manual */}
                    <View style={[styles.durationInputContainer, { backgroundColor: colors.card }]}>
                        <TextInput
                            style={[styles.durationInput, { color: colors.primary }]}
                            value={duration}
                            onChangeText={setDuration}
                            keyboardType="number-pad"
                            maxLength={3}
                            textAlign="center"
                        />
                        <Text style={{ color: colors.textSecondary, fontWeight: 'bold' }}>Días</Text>
                    </View>

                    {/* Botones Rápidos (Presets) */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                        {['3', '7', '14', '30'].map((d) => (
                            <TouchableOpacity
                                key={d}
                                style={[
                                    styles.presetChip,
                                    { backgroundColor: duration === d ? colors.primary : (isDark ? '#333' : '#E0E0E0') }
                                ]}
                                onPress={() => setDuration(d)}
                            >
                                <Text style={{
                                    fontWeight: 'bold',
                                    color: duration === d ? '#fff' : colors.text
                                }}>{d}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
                {/* ----------------------------------------- */}

                <Text style={[styles.label, { color: colors.text }]}>INVITAR AMIGOS ({selectedFriends.length})</Text>
                {loading ? <ActivityIndicator color={colors.primary} /> : (
                    <View>
                        {myFriends.length > 0 ? (
                            myFriends.map(friend => (
                                <View key={friend.id}>{renderFriendSelect({ item: friend })}</View>
                            ))
                        ) : (
                            <Text style={{ color: colors.textSecondary }}>No tienes amigos para retar aún.</Text>
                        )}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                <TouchableOpacity onPress={handleCreate} disabled={creating} style={{ width: '100%' }}>
                    <LinearGradient
                        colors={['#FF00CC', '#FF9933']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.createButton}
                    >
                        {creating ? <ActivityIndicator color="#fff" /> : (
                            <Text style={styles.btnText}>CREAR RETO 🔥</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    label: { fontSize: 13, fontWeight: '700', marginBottom: 10, marginTop: 20, opacity: 0.6 },
    input: { padding: 15, borderRadius: 12, fontSize: 16 },

    // Estilos Duración
    durationInputContainer: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
        height: 50, borderRadius: 12, minWidth: 100, justifyContent: 'center'
    },
    durationInput: { fontSize: 20, fontWeight: 'bold', marginRight: 5, width: 40 },
    presetChip: {
        width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center', marginRight: 10
    },

    friendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, marginBottom: 8 },
    avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    friendName: { fontWeight: '600', fontSize: 16 },
    checkbox: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, borderTopWidth: 1 },
    createButton: { padding: 18, borderRadius: 16, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }
});