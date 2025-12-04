import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function SocialScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const currentUser = auth.currentUser;

  // --- ESTADOS ---
  const [activeTab, setActiveTab] = useState('friends');

  // ESTADO DEL MODAL (VENTANA FLOTANTE)
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

  // --- ACCIONES DE BÚSQUEDA (MODAL) ---
  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setLoading(true);
    try {
      const results = await UserService.searchUsers(searchText.trim());
      const myFriendIds = friends.map(f => f.id);
      const filtered = results.filter(u => u.id !== currentUser.uid && !myFriendIds.includes(u.id));

      if (filtered.length === 0) Alert.alert("Info", "No se encontraron usuarios.");
      setSearchResults(filtered);
    } catch (e) {
      Alert.alert("Error", "Fallo al buscar");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetUser) => {
    try {
      await UserService.sendFriendRequest(
        currentUser.uid, myProfile?.username || 'Usuario', myProfile?.avatar, targetUser.id
      );
      FeedbackService.triggerImpactLight();
      Alert.alert("Enviado", `Solicitud enviada a ${targetUser.username}`);
      // Quitamos al usuario de la lista y cerramos si quieres
      setSearchResults(prev => prev.filter(u => u.id !== targetUser.id));
    } catch (error) { Alert.alert("Info", "Ya enviaste solicitud o error."); }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSearchText('');
    setSearchResults([]);
  };

  // --- OTRAS ACCIONES ---
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

  // --- RENDERIZADORES ---

  const renderUserAvatar = (avatarUrl, name, size = 40) => {
    if (avatarUrl && avatarUrl.startsWith('http')) {
      return <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />;
    }
    return <Text style={{ color: '#0288D1', fontWeight: 'bold', fontSize: size * 0.4 }}>{name?.[0]?.toUpperCase()}</Text>;
  };

  const renderSearchItem = ({ item }) => (
    <View style={[styles.userRow, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
      <View style={[styles.avatarSmall, { backgroundColor: isDark ? '#333' : '#F0F4FF', overflow: 'hidden' }]}>
        {renderUserAvatar(item.avatar, item.username, 36)}
      </View>
      <Text style={[styles.textBold, { marginLeft: 10, flex: 1, color: colors.text }]} numberOfLines={1}>{item.username}</Text>
      <TouchableOpacity style={[styles.btnSmall, { backgroundColor: colors.primary }]} onPress={() => handleSendRequest(item)}>
        <Text style={styles.btnTextSmall}>AGREGAR</Text>
      </TouchableOpacity>
    </View>
  );

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

  const renderChallengeItem = ({ item }) => {
    const myData = item.participants.find(p => p.userId === currentUser.uid);
    const rivalData = item.participants.find(p => p.userId !== currentUser.uid);
    const rivalNameObj = friends.find(f => f.id === rivalData.userId);
    const rivalName = rivalNameObj ? rivalNameObj.username : "Rival";
    const targetScore = item.durationDays || 7;
    const myProgress = Math.min((myData?.currentScore || 0) / targetScore, 1);
    const rivalProgress = Math.min((rivalData?.currentScore || 0) / targetScore, 1);

    return (
      <View style={styles.challengeContainerVertical}>
        <LinearGradient
          colors={['#FF9966', '#FF5E62']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.challengeCard}
        >
          <View style={styles.challengeHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.challengeTitle} numberOfLines={1}>{item.challengeName}</Text>
              <Text style={styles.challengeSubtitle}>{item.durationDays} días</Text>
            </View>
            <TouchableOpacity onPress={() => handleGiveUp(item.id, item.challengeName)} style={styles.giveUpBtn}>
              <Ionicons name="flag" size={14} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.versusContainer}>
            <View style={styles.playerBlock}>
              <Text style={styles.scoreText}>{myData?.currentScore || 0}</Text>
              <Text style={styles.playerName} numberOfLines={1}>Tú</Text>
              <View style={styles.miniBarBg}>
                <View style={[styles.miniBarFill, { width: `${myProgress * 100}%`, backgroundColor: '#fff' }]} />
              </View>
            </View>
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.playerBlock}>
              <Text style={styles.scoreText}>{rivalData?.currentScore || 0}</Text>
              <Text style={styles.playerName} numberOfLines={1}>{rivalName}</Text>
              <View style={styles.miniBarBg}>
                <View style={[styles.miniBarFill, { width: `${rivalProgress * 100}%`, backgroundColor: 'rgba(255,255,255,0.5)' }]} />
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderFeedItem = ({ item }) => {
    const isChallenge = item.title.includes('ganado') || item.title.includes('duelo');
    const iconName = isChallenge ? 'trophy' : 'checkmark-circle';
    const iconColor = isChallenge ? '#FFD700' : '#4CD964';

    return (
      <View style={[styles.feedCard, { backgroundColor: colors.card, shadowColor: colors.text }]}>
        <View style={styles.feedAvatarContainer}>
          {renderUserAvatar(item.avatar, item.username, 40)}
        </View>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={[styles.feedUser, { color: colors.text }]} numberOfLines={1}>{item.username}</Text>
          </View>
          <Text style={[styles.feedText, { color: colors.textSecondary }]} numberOfLines={2}>{item.title}</Text>
          <Text style={[styles.feedHighlight, { color: colors.primary }]}>{item.description}</Text>
        </View>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ height: 50 }} />

      {/* HEADER */}
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Social</Text>
        {/* BOTÓN ABRIR MODAL */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={[styles.addBtn, { backgroundColor: colors.card }]}
        >
          <Ionicons name="person-add-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'friends' && { backgroundColor: colors.card }]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'friends' ? colors.primary : colors.textSecondary }]}>AMIGOS</Text>
          {requests.length > 0 && <View style={styles.badgeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'challenges' && { backgroundColor: colors.card }]}
          onPress={() => setActiveTab('challenges')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'challenges' ? colors.primary : colors.textSecondary }]}>RETOS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'feed' && { backgroundColor: colors.card }]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'feed' ? colors.primary : colors.textSecondary }]}>ACTIVIDAD</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}>
        {/* AMIGOS */}
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
                <TouchableOpacity onPress={loadData}>
                  <Ionicons name="refresh" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {loadingData ? <ActivityIndicator color={colors.primary} /> : (
                friends.length > 0 ? (
                  friends.map(friend => <View key={friend.id} style={{ marginBottom: 10 }}>{renderFriendItem({ item: friend })}</View>)
                ) : (
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>Aún no tienes amigos.</Text>
                )
              )}
            </View>
          </>
        )}

        {/* RETOS */}
        {activeTab === 'challenges' && (
          <>
            <TouchableOpacity style={{ marginBottom: 20 }} onPress={() => navigation.navigate('CreateChallenge')}>
              <LinearGradient colors={['#A855F7', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createChallengeBtn}>
                <Ionicons name="add" size={24} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Crear Nuevo Reto</Text>
              </LinearGradient>
            </TouchableOpacity>
            {challenges.length > 0 ? (
              challenges.map(challenge => <View key={challenge.id}>{renderChallengeItem({ item: challenge })}</View>)
            ) : (
              <View style={[styles.emptyState, { borderColor: colors.border }]}>
                <Ionicons name="trophy-outline" size={50} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay retos activos.</Text>
              </View>
            )}
          </>
        )}

        {/* FEED */}
        {activeTab === 'feed' && (
          <View style={styles.feedContainer}>
            {feed.length > 0 ? (
              feed.map(item => <View key={item.id}>{renderFeedItem({ item })}</View>)
            ) : (
              <View style={[styles.emptyState, { borderColor: colors.border }]}>
                <Ionicons name="newspaper-outline" size={50} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, marginTop: 10, textAlign: 'center' }}>Sin actividad reciente.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* --- MODAL DE BÚSQUEDA --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>

            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Buscar Personas</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Barra de Búsqueda */}
            <View style={[styles.searchBarModal, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Nombre exacto..."
                placeholderTextColor={colors.textSecondary}
                value={searchText} onChangeText={setSearchText}
                onSubmitEditing={handleSearch}
                autoCapitalize='none'
                autoFocus={true} // Teclado arriba
              />
              <TouchableOpacity onPress={handleSearch}>
                <Ionicons name="arrow-forward" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Resultados */}
            <View style={{ marginTop: 20, flex: 1 }}>
              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={item => item.id}
                  renderItem={renderSearchItem}
                  ListEmptyComponent={
                    searchText.length > 0 && !loading ? (
                      <Text style={{ textAlign: 'center', color: colors.textSecondary }}>No encontrado.</Text>
                    ) : null
                  }
                />
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

  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 5 },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tabText: { fontWeight: '700', fontSize: 13 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginLeft: 6 },

  group: { marginBottom: 25 },
  label: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 10, textTransform: 'uppercase' },

  friendCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16 },
  requestCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 16, marginBottom: 12 },
  feedCard: { padding: 15, borderRadius: 16, marginBottom: 10 },
  challengeContainerVertical: { marginBottom: 15 },

  avatarMedium: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  textBold: { fontWeight: '600', fontSize: 16 },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  btnTextSmall: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  challengeCard: { width: '100%', height: 160, borderRadius: 20, padding: 20, justifyContent: 'space-between', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  challengeTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  challengeSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  giveUpBtn: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 10 },
  versusContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playerBlock: { width: '40%' },
  scoreText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  playerName: { color: '#fff', fontSize: 12, opacity: 0.9, marginBottom: 4 },
  vsText: { color: '#fff', fontWeight: 'bold', opacity: 0.5 },
  miniBarBg: { width: '100%', height: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2 },
  miniBarFill: { height: '100%', borderRadius: 2 },

  feedAvatarContainer: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  feedUser: { fontSize: 14, fontWeight: 'bold' },
  feedText: { fontSize: 13, marginTop: 2 },
  feedHighlight: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  emptyState: { padding: 40, alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderRadius: 20, justifyContent: 'center' },
  emptyText: { color: '#888', marginTop: 10, fontWeight: '600' },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1 },
  createChallengeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, shadowColor: "#A855F7", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', height: '60%', borderRadius: 25, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  searchBarModal: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 12, paddingHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 5, borderRadius: 12 },
});