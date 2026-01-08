import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated, Dimensions,
  FlatList,
  Image, Modal,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';
import ChallengeService from '../../services/challengeService';
import FeedService from '../../services/feedService';
import FeedbackService from '../../services/feedbackService';
import UserService from '../../services/userService';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function SocialScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const currentUser = auth.currentUser;

  // --- ESTADOS ---
  const [activeTab, setActiveTab] = useState('friends');
  const [modalVisible, setModalVisible] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [requests, setRequests] = useState([]);
  const [feed, setFeed] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [myProfile, setMyProfile] = useState(null);

  // Animación Tabs
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  // --- CARGA DE DATOS ---
  const loadData = async () => {
    try {
      if (!currentUser) return;

      const userDocRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        setLoadingData(false);
        return;
      }

      const userData = userSnap.data();
      setMyProfile(userData);

      const friendIds = userData.friendList || [];
      if (friendIds.length > 0) {
        const friendsData = await UserService.getFriendsDetails(friendIds);
        setFriends(friendsData);

        const feedQueryIds = [...friendIds, currentUser.uid];
        const recentActivity = await FeedService.getFriendsFeed(feedQueryIds);
        setFeed(recentActivity);
      } else {
        setFriends([]);
        setFeed([]);
      }

      const incoming = await UserService.getIncomingRequests(currentUser.uid);
      setRequests(incoming);

      const activeChallenges = await ChallengeService.getMyChallenges(currentUser.uid);
      // Filtramos los retos donde me he rendido
      const surviving = activeChallenges.filter(c => {
        const me = c.participants.find(p => p.userId === currentUser.uid);
        return me && !me.hasFailed;
      });
      setChallenges(surviving);

    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoadingData(false);
    }
  };

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  // --- ACCIONES ---
  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setLoading(true);
    try {
      const results = await UserService.searchUsers(searchText.trim());
      const myFriendIds = friends.map(f => f.id);
      const filtered = results.filter(u => u.id !== currentUser.uid && !myFriendIds.includes(u.id));
      if (filtered.length === 0) Alert.alert("Info", "Sin resultados.");
      setSearchResults(filtered);
    } catch (e) { Alert.alert("Error", "Fallo al buscar"); } finally { setLoading(false); }
  };

  const handleSendRequest = async (targetUser) => {
    try {
      await UserService.sendFriendRequest(
        currentUser.uid, myProfile?.username || 'Usuario', myProfile?.avatar, targetUser.id
      );
      FeedbackService.triggerImpactLight();
      Alert.alert("Enviado", `Solicitud enviada a ${targetUser.username}`);
      setSearchResults(prev => prev.filter(u => u.id !== targetUser.id));
    } catch (error) { Alert.alert("Info", "Ya enviaste solicitud o error."); }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSearchText('');
    setSearchResults([]);
  };

  const handleAcceptRequest = async (req) => {
    try {
      await UserService.acceptFriendRequest(req.id, req.fromId, currentUser.uid);
      FeedbackService.triggerSuccess();
      loadData();
    } catch (e) { Alert.alert("Error", "No se pudo aceptar"); }
  };

  const handleRejectRequest = async (reqId) => {
    try { await UserService.rejectFriendRequest(reqId); loadData(); } catch (e) { }
  };

  const handleGiveUp = (challengeId, challengeName) => {
    Alert.alert("Abandonar", `¿Rendirse en ${challengeName}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Rendirse", style: "destructive", onPress: async () => {
          await ChallengeService.giveUpChallenge(challengeId, currentUser.uid);
          loadData();
        }
      }
    ]);
  };

  const handleDeleteChallenge = (challengeId, challengeName) => {
    Alert.alert("Eliminar", `¿Borrar definitivamente "${challengeName}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          try { await ChallengeService.deleteChallenge(challengeId); loadData(); }
          catch (e) { Alert.alert("Error", "No se pudo eliminar."); }
        }
      }
    ]);
  };

  const handleDeleteActivity = (item) => {
    if (item.userId !== currentUser.uid) return;
    Alert.alert("Borrar Actividad", "¿Eliminar evento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          try { await FeedService.deleteActivity(item.id); loadData(); }
          catch (e) { Alert.alert("Error", "No se pudo borrar."); }
        }
      }
    ]);
  };

  // --- RENDERIZADORES (FIXED) ---

  // 1. Render Avatar Robusto (Arreglado bug de nombres)
  const renderUserAvatar = (avatarUrl, name, size = 40) => {
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('http')) {
      return <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />;
    }
    // Fallback seguro
    const initial = (name && typeof name === 'string') ? name.charAt(0).toUpperCase() : '?';

    return (
      <Text style={{ color: '#0288D1', fontWeight: 'bold', fontSize: size * 0.45 }}>
        {initial}
      </Text>
    );
  };

  // 2. Render RETO (Con Optimistic Update)
  const renderChallengeItem = ({ item, index }) => {
    const myData = item.participants.find(p => p.userId === currentUser.uid);
    const myScore = myData?.currentScore || 0;
    const target = item.durationDays;
    const progress = Math.min(myScore / target, 1);

    // Check del día
    const today = new Date().toISOString().split('T')[0];
    const isCompletedToday = myData?.lastCompletedDate === today;

    const handleChallengeToggle = async () => {
      // 1. Guardar estado anterior por si hay error (Rollback)
      const previousChallenges = [...challenges];

      // 2. Definir nuevo estado optimista
      const newScore = isCompletedToday ? Math.max(0, myScore - 1) : myScore + 1;
      const newDate = isCompletedToday ? null : today;

      // 3. Actualizar UI INMEDIATAMENTE
      setChallenges(current => current.map(c => {
        if (c.id === item.id) {
          return {
            ...c,
            participants: c.participants.map(p => {
              if (p.userId === currentUser.uid) {
                return { ...p, currentScore: newScore, lastCompletedDate: newDate };
              }
              return p;
            })
          };
        }
        return c;
      }));

      // 4. Feedback Háptico Inmediato
      if (isCompletedToday) FeedbackService.triggerImpactLight();
      else FeedbackService.triggerSuccess();

      // 5. Llamada asíncrona a Firebase (Fuego y olvido)
      try {
        if (isCompletedToday) {
          await ChallengeService.undoCheckInChallenge(item.id, currentUser.uid);
        } else {
          await ChallengeService.checkInChallenge(item.id, currentUser.uid);
        }
        // NOTA: Ya no llamamos a loadData() para evitar parpadeos. 
        // Confiamos en nuestro cálculo local.
      } catch (error) {
        console.error("Error sync reto:", error);
        Alert.alert("Error", "No se pudo sincronizar el reto.");
        setChallenges(previousChallenges); // Revertir cambios
      }
    };

    // Nombres para el pie
    const footerText = item.participants.map(p => {
      const pName = p.userId === currentUser.uid ? 'Tú' : (p.username || 'Amigo');
      const shortName = pName.split(' ')[0];
      return `${shortName} (${p.currentScore || 0})`;
    }).join('   ');

    const gradientColors = index % 2 === 0 ? ['#BD00FF', '#FF0055'] : ['#007AFF', '#00C6FF'];

    return (
      <TouchableOpacity
        style={styles.challengeContainerVertical}
        activeOpacity={0.95}
        onLongPress={() => handleDeleteChallenge(item.id, item.challengeName)}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.challengeCardGradient}
        >
          {/* Cabecera + Check */}
          <View style={styles.challengeHeader}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.challengeTitle} numberOfLines={1}>{item.challengeName}</Text>
              <View style={styles.challengeSubtitleRow}>
                <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.challengeSubtitle}> {item.durationDays} días</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.actionCheckBtn,
                isCompletedToday
                  ? { backgroundColor: '#34C759', borderColor: '#34C759' }
                  : { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.5)' }
              ]}
              onPress={handleChallengeToggle}
            >
              <Ionicons name={isCompletedToday ? "checkmark" : "ellipse-outline"} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Caras de Participantes (Face Pile) */}
          <View style={styles.avatarsRow}>
            {item.participants.map((participant, i) => {
              let avatarToShow = null;
              let nameToShow = '';

              if (participant.userId === currentUser.uid) {
                avatarToShow = myProfile?.avatar;
                nameToShow = myProfile?.username;
              } else {
                const f = friends.find(fr => fr.id === participant.userId);
                avatarToShow = f?.avatar;
                nameToShow = f?.username || participant.username;
              }

              return (
                <View key={participant.userId} style={[styles.participantAvatarFrame, { marginLeft: i > 0 ? -12 : 0, zIndex: 10 - i }]}>
                  {renderUserAvatar(avatarToShow, nameToShow, 34)}
                </View>
              );
            })}
          </View>

          {/* Barra Progreso */}
          <View style={styles.progressContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.progressLabel}>Tu progreso</Text>
              <Text style={styles.progressValue}>{myScore}/{target} Días</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>

          {/* Pie */}
          <View style={styles.challengeFooter}>
            <Text style={styles.participantsText} numberOfLines={1}>{footerText}</Text>
            <TouchableOpacity onPress={() => handleGiveUp(item.id, item.challengeName)}>
              <Ionicons name="flag-outline" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderFeedItem = ({ item }) => {
    const isChallenge = item.title.includes('ganado') || item.title.includes('duelo');
    const iconName = isChallenge ? 'trophy' : 'checkmark-circle';
    const iconColor = isChallenge ? '#FFD700' : '#4CD964';

    return (
      <TouchableOpacity
        onLongPress={() => handleDeleteActivity(item)}
        activeOpacity={0.9}
        style={[styles.feedCard, { backgroundColor: colors.card, shadowColor: colors.text }]}
      >
        <View style={styles.feedAvatarContainer}>
          {renderUserAvatar(item.avatar, item.username, 40)}
        </View>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <Text style={[styles.feedUser, { color: colors.text }]} numberOfLines={1}>{item.username}</Text>
          <Text style={[styles.feedText, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.title}
            {item.description ? <Text style={{ fontWeight: 'bold', color: colors.primary }}> {item.description}</Text> : null}
          </Text>
        </View>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </TouchableOpacity>
    );
  };

  const renderFriendItem = ({ item }) => (
    <View style={[styles.friendCard, { backgroundColor: colors.card }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={[styles.avatarMedium, { backgroundColor: isDark ? '#333' : '#E1F5FE', overflow: 'hidden' }]}>
          {renderUserAvatar(item.avatar, item.username, 44)}
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={[styles.textBold, { color: colors.text }]} numberOfLines={1}>{item.username}</Text>
          <Text style={{ fontSize: 12, color: '#34C759' }}>Conectado</Text>
        </View>
      </View>
    </View>
  );

  const renderSearchItem = ({ item }) => (
    <View style={[styles.userRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={[styles.avatarSmall, { backgroundColor: isDark ? '#333' : '#F0F4FF', overflow: 'hidden' }]}>
        {renderUserAvatar(item.avatar, item.username, 36)}
      </View>
      <Text style={[styles.textBold, { marginLeft: 10, flex: 1, color: colors.text }]} numberOfLines={1}>{item.username}</Text>
      <TouchableOpacity style={[styles.btnSmall, { backgroundColor: colors.primary }]} onPress={() => handleSendRequest(item)}>
        <Text style={styles.btnTextSmall}>AGREGAR</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRequestItem = ({ item }) => (
    <View style={[styles.requestRow, { backgroundColor: colors.card, borderColor: colors.primary }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
        <View style={[styles.avatarSmall, { backgroundColor: isDark ? '#333' : '#E1F5FE' }]}>
          {renderUserAvatar(item.fromAvatar, item.fromName, 36)}
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.textBold, { color: colors.text }]} numberOfLines={1}>{item.fromName}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>Quiere conectar</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity onPress={() => handleRejectRequest(item.id)}>
          <Ionicons name="close-circle" size={32} color="#EF5350" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleAcceptRequest(item)}>
          <Ionicons name="checkmark-circle" size={32} color="#4CD964" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const switchTab = (tab) => {
    setActiveTab(tab);
    Animated.spring(tabIndicatorAnim, {
      toValue: tab === 'friends' ? 0 : (tab === 'challenges' ? 1 : 2),
      useNativeDriver: true, bounciness: 10
    }).start();
  };
  const indicatorTranslateX = tabIndicatorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, (SCREEN_WIDTH - 40) / 3, ((SCREEN_WIDTH - 40) / 3) * 2]
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ height: 50 }} />

      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Social</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={[styles.addBtn, { backgroundColor: colors.card }]}>
          <Ionicons name="person-add-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <View style={[styles.tabBackground, { backgroundColor: colors.card }]}>
          <Animated.View style={[styles.tabIndicator, { backgroundColor: colors.primary, transform: [{ translateX: indicatorTranslateX }] }]} />
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('friends')}>
            <Text style={[styles.tabText, { color: activeTab === 'friends' ? '#fff' : colors.textSecondary }]}>AMIGOS</Text>
            {requests.length > 0 && <View style={styles.badgeDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('challenges')}>
            <Text style={[styles.tabText, { color: activeTab === 'challenges' ? '#fff' : colors.textSecondary }]}>RETOS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('feed')}>
            <Text style={[styles.tabText, { color: activeTab === 'feed' ? '#fff' : colors.textSecondary }]}>ACTIVIDAD</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}>
        {activeTab === 'friends' && (
          <>
            {requests.length > 0 && (
              <View style={styles.group}>
                <Text style={styles.label}>🔔 Solicitudes ({requests.length})</Text>
                {requests.map(req => <View key={req.id}>{renderRequestItem({ item: req })}</View>)}
              </View>
            )}
            <View style={styles.group}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={styles.label}>MIS AMIGOS</Text>
                <TouchableOpacity onPress={loadData}><Ionicons name="refresh" size={18} color={colors.textSecondary} /></TouchableOpacity>
              </View>
              {loadingData ? <ActivityIndicator color={colors.primary} /> : (
                friends.length > 0 ? friends.map(friend => <View key={friend.id} style={{ marginBottom: 10 }}>{renderFriendItem({ item: friend })}</View>)
                  : <View style={[styles.emptyState, { borderColor: colors.border }]}><Ionicons name="people-outline" size={50} color={colors.textSecondary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aún no tienes amigos.</Text></View>
              )}
            </View>
          </>
        )}

        {activeTab === 'challenges' && (
          <>
            <TouchableOpacity style={{ marginBottom: 20 }} onPress={() => navigation.navigate('CreateChallenge')}>
              <LinearGradient colors={['#A855F7', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createChallengeBtn}>
                <Ionicons name="add" size={24} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Crear Nuevo Reto</Text>
              </LinearGradient>
            </TouchableOpacity>
            {challenges.length > 0 ? challenges.map((challenge, i) => <View key={challenge.id}>{renderChallengeItem({ item: challenge, index: i })}</View>)
              : <View style={[styles.emptyState, { borderColor: colors.border }]}><Ionicons name="trophy-outline" size={50} color={colors.textSecondary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay retos activos.</Text></View>}
          </>
        )}

        {activeTab === 'feed' && (
          <View style={styles.feedContainer}>
            {feed.length > 0 ? feed.map(item => <View key={item.id}>{renderFeedItem({ item })}</View>)
              : <View style={[styles.emptyState, { borderColor: colors.border }]}><Ionicons name="newspaper-outline" size={50} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, marginTop: 10, textAlign: 'center' }}>Sin actividad reciente.</Text></View>}
          </View>
        )}
      </ScrollView>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Buscar Personas</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeBtn}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <View style={[styles.searchBarModal, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Nombre exacto..." placeholderTextColor={colors.textSecondary} value={searchText} onChangeText={setSearchText} onSubmitEditing={handleSearch} autoCapitalize='none' autoFocus={true} />
              <TouchableOpacity onPress={handleSearch}><Ionicons name="arrow-forward" size={24} color={colors.primary} /></TouchableOpacity>
            </View>
            <View style={{ marginTop: 20, flex: 1 }}>
              {loading ? <ActivityIndicator size="large" color={colors.primary} /> : (
                <FlatList data={searchResults} keyExtractor={item => item.id} renderItem={renderSearchItem} ListEmptyComponent={searchText.length > 0 && !loading ? <Text style={{ textAlign: 'center', color: colors.textSecondary }}>No encontrado.</Text> : null} />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  screenTitle: { fontSize: 32, fontWeight: '800' },
  addBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },

  tabContainer: { alignItems: 'center', marginBottom: 20 },
  tabBackground: { flexDirection: 'row', borderRadius: 25, width: SCREEN_WIDTH - 40, height: 50, position: 'relative', alignItems: 'center' },
  tabIndicator: { position: 'absolute', width: (SCREEN_WIDTH - 40) / 3, height: '100%', borderRadius: 25 },
  tabBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', height: '100%' },
  tabText: { fontWeight: '700', fontSize: 13 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginLeft: 6 },

  group: { marginBottom: 25 },
  label: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 10, textTransform: 'uppercase' },

  friendCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 10 },
  requestCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 16, marginBottom: 12 },
  feedCard: { padding: 15, borderRadius: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },

  challengeContainerVertical: { marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, borderRadius: 24, backgroundColor: 'transparent' },
  challengeCardGradient: { borderRadius: 24, padding: 20, minHeight: 220 },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  challengeTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 2, flex: 1, marginRight: 10 },
  challengeSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '500' },
  challengeSubtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },

  avatarsRow: { flexDirection: 'row', marginBottom: 15, paddingLeft: 5, height: 40, alignItems: 'center' },
  participantAvatarFrame: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },

  progressContainer: { backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 12, marginBottom: 15 },
  progressLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  progressValue: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  progressBarTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginTop: 6 },
  progressBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },

  challengeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  participantsText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, flex: 1, marginRight: 10 },

  avatarMedium: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  feedAvatarContainer: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },

  textBold: { fontWeight: '600', fontSize: 16 },
  feedUser: { fontSize: 14, fontWeight: 'bold' },
  feedText: { fontSize: 13, marginTop: 2 },
  feedHighlight: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  btnTextSmall: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  actionCheckBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  createChallengeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, shadowColor: "#A855F7", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginBottom: 20 },

  emptyState: { padding: 40, alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderRadius: 20, justifyContent: 'center' },
  emptyText: { color: '#888', marginTop: 10, fontWeight: '600' },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 5, borderRadius: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', height: '60%', borderRadius: 25, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  searchBarModal: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 12, paddingHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
});