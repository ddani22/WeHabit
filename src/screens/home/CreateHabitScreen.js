import GraphemeSplitter from 'grapheme-splitter';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { auth } from '../../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';
import HabitService from '../../services/habitService';
import UserService from '../../services/userService';

const splitter = new GraphemeSplitter();

const DAYS = [
  { id: 1, label: 'L' }, { id: 2, label: 'M' }, { id: 3, label: 'X' },
  { id: 4, label: 'J' }, { id: 5, label: 'V' }, { id: 6, label: 'S' }, { id: 0, label: 'D' }
];

// Paleta de colores para que el usuario elija
const COLOR_PALETTE = [
  '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55', '#A2845E', '#8E8E93'
];

export default function CreateHabitScreen({ route, navigation }) {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const user = auth.currentUser;

  const habitToEdit = route.params?.habitToEdit;
  const isEditing = !!habitToEdit;

  // Estados del formulario
  const [name, setName] = useState(isEditing ? habitToEdit.name : '');
  const [icon, setIcon] = useState(isEditing ? habitToEdit.icon : '💪');
  const [frequency, setFrequency] = useState(isEditing ? habitToEdit.frequency : [1, 2, 3, 4, 5]);

  // Estado de Categorías
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Estado del Modal de Nueva Categoría
  const [modalVisible, setModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Editar Hábito' : 'Nuevo Hábito' });
    loadCategories();
  }, []);

  const loadCategories = async () => {
    // 1. Cargamos las categorías guardadas del usuario
    const userCats = await UserService.getUserCategories(user.uid);

    // 2. Si no tiene ninguna, podemos poner unas por defecto o dejarlo vacío
    // Para este ejemplo, fusionamos con una "General" básica
    const allCats = [
      { id: 'default', label: 'General', color: '#8E8E93' },
      ...userCats
    ];
    setCategories(allCats);

    // 3. Pre-seleccionar
    if (isEditing && habitToEdit.categoryId) {
      const found = allCats.find(c => c.id === habitToEdit.categoryId);
      setSelectedCategory(found || allCats[0]);
    } else {
      setSelectedCategory(allCats[0]);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return Alert.alert("Falta nombre", "Ponle nombre a la categoría");

    const newCat = {
      id: Date.now().toString(), // ID único simple
      label: newCatName,
      color: newCatColor
    };

    try {
      await UserService.addCustomCategory(user.uid, newCat);
      setCategories([...categories, newCat]); // Actualizamos lista local
      setSelectedCategory(newCat); // La seleccionamos automáticamente
      setModalVisible(false);
      setNewCatName('');
    } catch (e) {
      Alert.alert("Error", "No se pudo crear la categoría");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert("Error", "Ponle nombre.");
    if (frequency.length === 0) return Alert.alert("Error", "Selecciona días.");

    setLoading(true);
    try {
      // Preparamos el objeto de datos de categoría para guardar
      const categoryData = {
        id: selectedCategory.id,
        label: selectedCategory.label,
        color: selectedCategory.color
      };

      if (isEditing) {
        await HabitService.updateHabit(habitToEdit.id, {
          name, icon, frequency,
          // Guardamos los campos desglosados
          categoryId: categoryData.id,
          categoryLabel: categoryData.label,
          categoryColor: categoryData.color
        });
      } else {
        await HabitService.createHabit(user.uid, name, frequency, icon, categoryData);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar.");
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayId) => {
    if (frequency.includes(dayId)) setFrequency(frequency.filter(id => id !== dayId));
    else setFrequency([...frequency, dayId]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.label, { color: colors.text }]}>Nombre del Hábito</Text>
        <TextInput
          style={[styles.input, { backgroundColor: isDark ? '#1E1E1E' : '#f0f0f0', color: colors.text }]}
          placeholder="Ej. Leer 15 minutos"
          placeholderTextColor={colors.textSecondary}
          value={name} onChangeText={setName} autoFocus={!isEditing}
        />

        <Text style={[styles.label, { color: colors.text }]}>Icono</Text>
        <TextInput
          style={[styles.emojiInput, { backgroundColor: isDark ? '#1E1E1E' : '#f0f0f0', color: colors.text }]}
          value={icon}
          onChangeText={(text) => {
            if (!text) { setIcon(''); return; }
            const g = splitter.splitGraphemes(text);
            setIcon(g.pop());
          }}
        />

        {/* SELECTOR DE CATEGORÍA DINÁMICO */}
        <Text style={[styles.label, { color: colors.text }]}>Categoría</Text>
        <View style={styles.categoriesContainer}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory?.id === cat.id && { backgroundColor: cat.color, borderColor: cat.color },
                { borderColor: isDark ? '#333' : '#e0e0e0' }
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory?.id === cat.id ? { color: '#fff' } : { color: colors.textSecondary }
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Botón para crear nueva */}
          <TouchableOpacity
            style={[styles.categoryChip, { borderColor: colors.primary, borderStyle: 'dashed' }]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>+ Nueva</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Frecuencia</Text>
        <View style={styles.daysContainer}>
          {DAYS.map((day) => {
            const isSelected = frequency.includes(day.id);
            return (
              <TouchableOpacity
                key={day.id}
                style={[
                  styles.dayButton,
                  { backgroundColor: isSelected ? '#4A90E2' : (isDark ? '#333' : '#eee') }
                ]}
                onPress={() => toggleDay(day.id)}
              >
                <Text style={[styles.dayText, { color: isSelected ? '#fff' : colors.text }]}>{day.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: isDark ? '#fff' : '#333' }]}
          onPress={handleSave} disabled={loading}
        >
          {loading ? <ActivityIndicator color={isDark ? '#000' : '#fff'} /> : (
            <Text style={[styles.btnText, { color: isDark ? '#000' : '#fff' }]}>
              {isEditing ? 'GUARDAR CAMBIOS' : 'CREAR HÁBITO'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL DE CREAR CATEGORÍA */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nueva Categoría</Text>

            <TextInput
              placeholder="Nombre (Ej. Arte)"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: isDark ? '#333' : '#f0f0f0', color: colors.text, width: '100%' }]}
              value={newCatName}
              onChangeText={setNewCatName}
            />

            <Text style={{ color: colors.textSecondary, marginTop: 15, marginBottom: 10 }}>Elige un color:</Text>
            <View style={styles.colorGrid}>
              {COLOR_PALETTE.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    newCatColor === color && { borderWidth: 3, borderColor: colors.text }
                  ]}
                  onPress={() => setNewCatColor(color)}
                />
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 10 }}>
                <Text style={{ color: colors.danger }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateCategory} style={{ padding: 10, backgroundColor: colors.primary, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
  input: { padding: 15, borderRadius: 10, fontSize: 16 },
  emojiInput: { padding: 15, borderRadius: 10, fontSize: 30, textAlign: 'center', width: 80 },
  daysContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  dayButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontWeight: 'bold' },
  createButton: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 40 },
  btnText: { fontWeight: 'bold', fontSize: 16 },
  categoriesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  categoryChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, marginBottom: 5 },
  categoryText: { fontSize: 14, fontWeight: '600' },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', padding: 20, borderRadius: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 },
  colorCircle: { width: 30, height: 30, borderRadius: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }
});