import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';
import ChallengeService from '../../services/challengeService';
import FeedService from '../../services/feedService';
import FeedbackService from '../../services/feedbackService';
import UserService from '../../services/userService';

const SCREEN_WIDTH = Dimensions.get('window').width;

// --- HELPERS ---

// Fecha Local YYYY-MM-DD
const getLocalTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Tiempo Relativo
const getTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return "Ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
};

// Agrupar Feed
const groupFeedByDate = (feedItems) => {
  const groups = { 'Hoy': [], 'Ayer': [], 'Esta Semana': [], 'Anteriormente': [] };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - (86400000 * 7);

  feedItems.forEach(item => {
    let dateMs;
    if (item.timestamp?.toDate) dateMs = item.timestamp.toDate().getTime();
    else if (item.timestamp) dateMs = new Date(item.timestamp).getTime();
    else dateMs = 0;

    if (dateMs >= today) groups['Hoy'].push(item);
    else if (dateMs >= yesterday) groups['Ayer'].push(item);
    else if (dateMs >= weekAgo) groups['Esta Semana'].push(item);
    else groups['Anteriormente'].push(item);
  });

  return Object.keys(groups)
    .filter(key => groups[key].length > 0)
    .map(key => ({ title: key, data: groups[key] }));
};

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
  const [groupedFeed, setGroupedFeed] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [myProfile, setMyProfile] = useState(null);

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  // 1. LISTENER RETOS
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'challenges'), where("participantIds", "array-contains", currentUser.uid), where("isActive", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const myData = data.participants.find(p => p.userId === currentUser.uid);
        if (myData && !myData.hasFailed) list.push({ id: docSnap.id, ...data, myProgress: myData });
      });
      setChallenges(list);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // 2. EFECTO FEED
  useEffect(() => {
    if (activeTab === 'feed') loadFeed();
  }, [activeTab]);

  // CARGA DATOS
  const loadData = async () => {
    try {
      if (!currentUser) return;
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) { setLoadingData(false); return; }

      const userData = userSnap.data();
      setMyProfile(userData);

      const friendIds = userData.friendList || [];
      if (friendIds.length > 0) {
        const friendsData = await UserService.getFriendsDetails(friendIds);
        setFriends(friendsData);
      } else {
        setFriends([]);
      }

      const incoming = await UserService.getIncomingRequests(currentUser.uid);
      setRequests(incoming);

    } catch (error) { console.error(error); }
    finally { setLoadingData(false); }
  };

  const loadFeed = async () => {
    if (!currentUser) return;
    setLoadingFeed(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const friendIds = userDoc.data()?.friendList || [];
      const feedIds = [...friendIds, currentUser.uid];

      const recentActivity = await FeedService.getFriendsFeed(feedIds);
      setFeed(recentActivity);
      setGroupedFeed(groupFeedByDate(recentActivity));
    } catch (e) { console.error("Feed error", e); }
    finally { setLoadingFeed(false); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

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
      await UserService.sendFriendRequest(currentUser.uid, myProfile?.username, myProfile?.avatar, targetUser.id);
      Alert.alert("Enviado", `Solicitud a ${targetUser.username}`);
      setSearchResults(prev => prev.filter(u => u.id !== targetUser.id));
    } catch (error) { Alert.alert("Info", "Error enviando solicitud."); }
  };

  const closeModal = () => { setModalVisible(false); setSearchText(''); setSearchResults([]); };

  const handleAcceptRequest = async (req) => {
    try {
      await UserService.acceptFriendRequest(req.id, req.fromId, currentUser.uid);
      FeedbackService.triggerSuccess();
      loadData();
    } catch (e) { Alert.alert("Error", "Error al aceptar"); }
  };

  const handleRejectRequest = async (reqId) => { try { await UserService.rejectFriendRequest(reqId); loadData(); } catch (e) { } };

  const handleCheckInToggle = async (challenge, isCompletedToday) => {
    try {
      if (isCompletedToday) {
        FeedbackService.triggerImpactLight();
        await ChallengeService.undoCheckInChallenge(challenge.id, currentUser.uid);
      } else {
        FeedbackService.triggerSuccess();
        await ChallengeService.checkInChallenge(challenge.id, currentUser.uid);
      }
    } catch (error) { Alert.alert("Error", "No se pudo actualizar."); }
  };

  const handleGiveUp = (challenge) => {
    Alert.alert("Abandonar", `¿Rendirse en "${challenge.challengeName}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Rendirse", style: "destructive", onPress: () => ChallengeService.giveUpChallenge(challenge.id, currentUser.uid) }
    ]);
  };

  const handleDeleteActivity = (item) => {
    if (item.userId !== currentUser.uid) return;
    Alert.alert("Borrar", "¿Eliminar actividad?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          await FeedService.deleteActivity(item.id);
          loadFeed();
        }
      }
    ]);
  };

  // --- RENDERIZADORES ---

  const renderUserAvatar = (avatarUrl, name, size = 40) => {
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('http')) {
      return <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />;
    }
    const initial = (name && typeof name === 'string') ? name.charAt(0).toUpperCase() : '?';
    return <Text style={{ color: '#0288D1', fontWeight: 'bold', fontSize: size * 0.45 }}>{initial}</Text>;
  };

  // === TARJETA DE RETO PRO (CORREGIDA: NOMBRES VISIBLES) ===
  const renderChallengeItem = ({ item }) => {
    const endDate = new Date(item.endDate);
    const now = new Date();
    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    const isExpired = daysLeft < 0;
    const today = getLocalTodayDate();

    // Mi estado
    const isCompletedToday = item.myProgress.lastCompletedDate === today;

    // Ordenar: YO primero, luego por PUNTOS
    const sortedParticipants = [...item.participants].sort((a, b) => {
      if (a.userId === currentUser.uid) return -1;
      if (b.userId === currentUser.uid) return 1;
      return (b.currentScore || 0) - (a.currentScore || 0);
    });

    return (
      <View style={[styles.proCard, { backgroundColor: colors.card, borderColor: isCompletedToday ? '#4CD964' : colors.border }]}>

        {/* Cabecera */}
        <View style={styles.proHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.proTitle, { color: colors.text }]}>{item.challengeName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.proSubtitle, { color: colors.textSecondary }]}>
                {isExpired ? "Finalizado" : ` Quedan ${daysLeft} días`} • Meta: {item.durationDays}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => handleGiveUp(item)} style={{ padding: 5 }}>
            <Ionicons name="flag-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Lista de Rivales */}
        <View style={styles.rivalsContainer}>
          {sortedParticipants.map((p) => {
            const isMe = p.userId === currentUser.uid;
            const pDoneToday = p.lastCompletedDate === today;
            const progressPercent = Math.min((p.currentScore || 0) / item.durationDays, 1);

            // CORRECCIÓN: Buscar nombre y avatar real en la lista de amigos
            let displayName = 'Jugador';
            let displayAvatar = null;

            if (isMe) {
              displayName = 'Tú';
              displayAvatar = myProfile?.avatar;
            } else {
              const friendData = friends.find(f => f.id === p.userId);
              displayName = friendData?.username || p.username || 'Jugador';
              displayAvatar = friendData?.avatar;
            }

            return (
              <View key={p.userId} style={styles.rivalRow}>
                {/* Avatar y Nombre */}
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.rivalAvatar, { borderColor: isMe ? colors.primary : 'transparent', borderWidth: isMe ? 2 : 0 }]}>
                    {renderUserAvatar(displayAvatar, displayName, 24)}
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={[styles.rivalName, { color: colors.text, fontWeight: isMe ? 'bold' : 'normal' }]}>
                      {displayName}
                    </Text>
                    {/* Barra Progreso Fina */}
                    <View style={styles.rivalBarBg}>
                      <View style={[styles.rivalBarFill, { width: `${progressPercent * 100}%`, backgroundColor: isMe ? colors.primary : colors.textSecondary }]} />
                    </View>
                  </View>
                </View>

                {/* Estado Diario */}
                <View style={{ alignItems: 'flex-end', minWidth: 60 }}>
                  {pDoneToday ? (
                    <View style={styles.statusBadgeDone}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                      <Text style={{ fontSize: 9, color: '#fff', fontWeight: 'bold', marginLeft: 2 }}>HOY</Text>
                    </View>
                  ) : (
                    <View style={styles.statusBadgePending}>
                      <Text style={{ fontSize: 9, color: '#888' }}>PENDIENTE</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>
                    {p.currentScore || 0}/{item.durationDays}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Botón de Acción Grande */}
        <TouchableOpacity
          onPress={() => handleCheckInToggle(item, isCompletedToday)}
          activeOpacity={0.8}
          style={[
            styles.proButton,
            {
              backgroundColor: isCompletedToday ? '#4CD964' : (isDark ? '#333' : '#F2F2F7'),
              shadowColor: isCompletedToday ? '#4CD964' : '#000'
            }
          ]}
        >
          <Text style={{
            color: isCompletedToday ? '#fff' : colors.text,
            fontWeight: 'bold',
            fontSize: 14
          }}>
            {isCompletedToday ? "¡COMPLETADO HOY!" : "MARCAR COMO HECHO"}
          </Text>
          {isCompletedToday && <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginLeft: 8 }} />}
        </TouchableOpacity>

      </View>
    );
  };

  // Render Feed
  const renderFeedItem = ({ item }) => {
    const isChallenge = item.title.toLowerCase().includes('reto') || item.title.toLowerCase().includes('duelo') || (item.type && item.type.includes('challenge'));
    const isStreak = item.title.toLowerCase().includes('racha');
    let iconName = 'checkmark-circle';
    let iconColor = '#4CD964';
    let borderColor = 'transparent';

    if (isChallenge) { iconName = 'trophy'; iconColor = '#FFD700'; borderColor = 'rgba(255, 215, 0, 0.3)'; }
    else if (isStreak) { iconName = 'flame'; iconColor = '#FF3B30'; }

    return (
      <TouchableOpacity onLongPress={() => handleDeleteActivity(item)} activeOpacity={0.8} style={[styles.feedCard, { backgroundColor: colors.card, borderColor: borderColor, borderWidth: isChallenge ? 1 : 0 }]}>
        <View style={styles.feedAvatarContainer}>
          {renderUserAvatar(item.avatar, item.username, 40)}
          <View style={[styles.miniBadge, { backgroundColor: colors.card }]}><Ionicons name={iconName} size={10} color={iconColor} /></View>
        </View>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[styles.feedUser, { color: colors.text }]} numberOfLines={1}>{item.username}</Text>
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>{getTimeAgo(item.timestamp)}</Text>
          </View>
          <Text style={[styles.feedText, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.title.replace(item.username, '').trim()}
            {item.description ? <Text style={{ fontWeight: 'bold', color: isChallenge ? '#FFD700' : colors.primary }}> {item.description}</Text> : null}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>{title}</Text>
    </View>
  );

  // Auxiliares
  const renderFriendItem = ({ item }) => (
    <View style={[styles.friendCard, { backgroundColor: colors.card }]}>
      <View style={[styles.avatarMedium, { backgroundColor: isDark ? '#333' : '#E1F5FE', overflow: 'hidden' }]}>{renderUserAvatar(item.avatar, item.username, 44)}</View>
      <View style={{ marginLeft: 12 }}><Text style={[styles.textBold, { color: colors.text }]}>{item.username}</Text><Text style={{ fontSize: 12, color: '#34C759' }}>Conectado</Text></View>
    </View>
  );
  const renderRequestItem = ({ item }) => (
    <View style={[styles.requestRow, { backgroundColor: colors.card, borderColor: colors.primary }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}><View style={[styles.avatarSmall, { backgroundColor: isDark ? '#333' : '#E1F5FE' }]}>{renderUserAvatar(item.fromAvatar, item.fromName, 36)}</View><Text style={{ marginLeft: 10, color: colors.text, fontWeight: 'bold' }}>{item.fromName}</Text></View>
      <View style={{ flexDirection: 'row', gap: 10 }}><TouchableOpacity onPress={() => handleRejectRequest(item.id)}><Ionicons name="close-circle" size={28} color="#EF5350" /></TouchableOpacity><TouchableOpacity onPress={() => handleAcceptRequest(item)}><Ionicons name="checkmark-circle" size={28} color="#4CD964" /></TouchableOpacity></View>
    </View>
  );
  const renderSearchItem = ({ item }) => (
    <View style={[styles.userRow, { backgroundColor: colors.card }]}>
      <View style={[styles.avatarSmall, { backgroundColor: isDark ? '#333' : '#F0F4FF' }]}>{renderUserAvatar(item.avatar, item.username, 36)}</View>
      <Text style={{ marginLeft: 10, flex: 1, color: colors.text }}>{item.username}</Text>
      <TouchableOpacity style={[styles.btnSmall, { backgroundColor: colors.primary }]} onPress={() => handleSendRequest(item)}><Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>AGREGAR</Text></TouchableOpacity>
    </View>
  );

  const switchTab = (tab) => {
    setActiveTab(tab);
    Animated.spring(tabIndicatorAnim, { toValue: tab === 'friends' ? 0 : (tab === 'challenges' ? 1 : 2), useNativeDriver: true }).start();
  };
  const indicatorTranslateX = tabIndicatorAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [0, (SCREEN_WIDTH - 40) / 3, ((SCREEN_WIDTH - 40) / 3) * 2] });

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
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('friends')}><Text style={[styles.tabText, { color: activeTab === 'friends' ? '#fff' : colors.textSecondary }]}>AMIGOS</Text>{requests.length > 0 && <View style={styles.badgeDot} />}</TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('challenges')}><Text style={[styles.tabText, { color: activeTab === 'challenges' ? '#fff' : colors.textSecondary }]}>RETOS</Text></TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('feed')}><Text style={[styles.tabText, { color: activeTab === 'feed' ? '#fff' : colors.textSecondary }]}>ACTIVIDAD</Text></TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {activeTab === 'friends' && (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {requests.length > 0 && <View style={styles.group}><Text style={styles.label}>🔔 Solicitudes</Text>{requests.map(req => <View key={req.id}>{renderRequestItem({ item: req })}</View>)}</View>}
            <View style={styles.group}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={styles.label}>MIS AMIGOS</Text>
                <TouchableOpacity onPress={loadData}><Ionicons name="refresh" size={18} color={colors.textSecondary} /></TouchableOpacity>
              </View>
              {friends.length > 0 ? friends.map(f => <View key={f.id} style={{ marginBottom: 10 }}>{renderFriendItem({ item: f })}</View>) : <Text style={styles.emptyText}>Sin amigos aún.</Text>}
            </View>
          </ScrollView>
        )}

        {activeTab === 'challenges' && (
          <FlatList
            data={challenges}
            renderItem={renderChallengeItem}
            keyExtractor={i => i.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListHeaderComponent={
              <TouchableOpacity style={{ marginBottom: 20 }} onPress={() => navigation.navigate('CreateChallenge')}>
                <LinearGradient colors={['#A855F7', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createChallengeBtn}>
                  <Ionicons name="add" size={24} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Crear Nuevo Reto</Text>
                </LinearGradient>
              </TouchableOpacity>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No hay retos activos.</Text>}
          />
        )}

        {activeTab === 'feed' && (
          <View style={{ flex: 1 }}>
            {loadingFeed ? (
              <View style={{ marginTop: 50 }}><ActivityIndicator color={colors.primary} size="large" /></View>
            ) : (
              <SectionList
                sections={groupedFeed}
                keyExtractor={(item) => item.id}
                renderItem={renderFeedItem}
                renderSectionHeader={renderSectionHeader}
                contentContainerStyle={{ paddingBottom: 40 }}
                stickySectionHeadersEnabled={false}
                ListEmptyComponent={
                  <View style={[styles.emptyState, { borderColor: colors.border }]}>
                    <Ionicons name="newspaper-outline" size={50} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Sin actividad reciente.</Text>
                  </View>
                }
              />
            )}
          </View>
        )}
      </View>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>Buscar</Text><TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity></View>
            <View style={[styles.searchBarModal, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Nombre..." placeholderTextColor={colors.textSecondary} value={searchText} onChangeText={setSearchText} onSubmitEditing={handleSearch} />
              <TouchableOpacity onPress={handleSearch}><Ionicons name="arrow-forward" size={24} color={colors.primary} /></TouchableOpacity>
            </View>
            <View style={{ marginTop: 20, flex: 1 }}>{loading ? <ActivityIndicator color={colors.primary} /> : <FlatList data={searchResults} keyExtractor={i => i.id} renderItem={renderSearchItem} />}</View>
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
  addBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowOpacity: 0.1, elevation: 3 },
  tabContainer: { alignItems: 'center', marginBottom: 20 },
  tabBackground: { flexDirection: 'row', borderRadius: 25, width: SCREEN_WIDTH - 40, height: 50, position: 'relative', alignItems: 'center' },
  tabIndicator: { position: 'absolute', width: (SCREEN_WIDTH - 40) / 3, height: '100%', borderRadius: 25 },
  tabBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', height: '100%' },
  tabText: { fontWeight: '700', fontSize: 13 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginLeft: 6 },
  group: { marginBottom: 25 },
  label: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 10, textTransform: 'uppercase' },

  // --- TARJETA PRO (RETO) ESTILOS ---
  proCard: { borderRadius: 24, padding: 18, marginBottom: 20, borderWidth: 1.5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  proHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 12 },
  proTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  proSubtitle: { fontSize: 12, fontWeight: '500', marginLeft: 4 },

  rivalsContainer: { marginBottom: 20, gap: 12 },
  rivalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rivalAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  rivalName: { fontSize: 14, marginBottom: 4 },
  rivalBarBg: { height: 4, width: 100, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2 },
  rivalBarFill: { height: '100%', borderRadius: 2 },

  statusBadgeDone: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CD964', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusBadgePending: { backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },

  proButton: { flexDirection: 'row', height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },

  // --- FIN TARJETA PRO ---

  friendCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 10 },
  requestCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 12 },

  feedCard: { padding: 15, borderRadius: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  feedAvatarContainer: { width: 40, height: 40, position: 'relative' },
  miniBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  feedUser: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  feedText: { fontSize: 13, lineHeight: 18 },
  sectionHeader: { paddingVertical: 10, paddingHorizontal: 5, marginBottom: 5 },
  sectionHeaderText: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },

  avatarMedium: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  textBold: { fontWeight: '600', fontSize: 16 },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  createChallengeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, marginBottom: 20 },
  emptyState: { padding: 40, alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderRadius: 20 },
  emptyText: { color: '#888', marginTop: 10 },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 5, borderRadius: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', height: '60%', borderRadius: 25, padding: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  searchBarModal: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 12, paddingHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
});