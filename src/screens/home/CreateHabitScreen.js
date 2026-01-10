import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth } from '../../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';
import HabitService from '../../services/habitService';

export default function CreateHabitScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const user = auth.currentUser;

  const habitToEdit = route.params?.habitToEdit;

  // Estados
  const [name, setName] = useState(habitToEdit?.name || '');

  // Icono: Libre escritura (Cualquier emoji del teclado)
  const [icon, setIcon] = useState(habitToEdit?.icon || '✨');

  const [frequency, setFrequency] = useState(habitToEdit?.frequency || 'daily');

  // Categoría: Totalmente personalizada
  const [categoryName, setCategoryName] = useState(habitToEdit?.categoryLabel || 'General');
  const [categoryColor, setCategoryColor] = useState(habitToEdit?.categoryColor || '#8E8E93');

  // Paleta de colores para elegir (puedes añadir más)
  const COLOR_PALETTE = [
    '#FF3B30', // Rojo
    '#FF9500', // Naranja
    '#FFCC00', // Amarillo
    '#4CD964', // Verde
    '#5AC8FA', // Azul Claro
    '#007AFF', // Azul
    '#5856D6', // Morado
    '#FF2D55', // Rosa
    '#8E8E93', // Gris
    '#A2845E', // Marrón
    '#333333'  // Negro
  ];

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Falta información", "Ponle un nombre al hábito.");
      return;
    }
    if (!categoryName.trim()) {
      Alert.alert("Categoría", "Ponle nombre a la categoría.");
      return;
    }

    // Construimos la categoría personalizada al vuelo
    const catId = categoryName.toLowerCase().replace(/\s+/g, '_'); // ID basado en el nombre
    const finalCategory = {
      id: catId,
      label: categoryName,
      color: categoryColor
    };

    try {
      if (habitToEdit) {
        await HabitService.updateHabit(habitToEdit.id, {
          name, frequency, icon,
          categoryId: finalCategory.id,
          categoryLabel: finalCategory.label,
          categoryColor: finalCategory.color
        });
      } else {
        await HabitService.createHabit(
          user.uid, name, frequency, icon, finalCategory
        );
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar.");
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {habitToEdit ? 'Editar Hábito' : 'Nuevo Hábito'}
        </Text>
      </View>

      {/* TARJETA 1: QUÉ VAMOS A HACER */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>NOMBRE E ICONO</Text>

        <View style={styles.row}>
          {/* INPUT ICONO (Editable) */}
          <View style={[styles.iconInputContainer, { backgroundColor: categoryColor }]}>
            <TextInput
              style={styles.iconInput}
              value={icon}
              onChangeText={setIcon}
              maxLength={2} // Para que no escriban textos largos, solo emojis
              selectTextOnFocus
              textAlign="center"
            />
          </View>

          {/* INPUT NOMBRE */}
          <TextInput
            style={[styles.nameInput, { color: colors.text }]}
            placeholder="Ej. Leer, Meditar..."
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            autoFocus={!habitToEdit}
          />
        </View>
      </View>

      {/* TARJETA 2: CATEGORÍA PERSONALIZADA */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORÍA & COLOR</Text>

        {/* Nombre de la Categoría */}
        <TextInput
          style={[styles.catNameInput, { color: colors.text, borderColor: colors.border }]}
          placeholder="Nombre de la categoría (Ej. Deportes)"
          placeholderTextColor={colors.textSecondary}
          value={categoryName}
          onChangeText={setCategoryName}
        />

        {/* Selector de Color */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorsRow}>
          {COLOR_PALETTE.map(color => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorCircle,
                { backgroundColor: color },
                categoryColor === color && styles.colorSelected
              ]}
              onPress={() => setCategoryColor(color)}
            >
              {categoryColor === color && <Ionicons name="checkmark" size={16} color="#fff" />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ height: 30 }} />

      <TouchableOpacity onPress={handleSave} activeOpacity={0.8}>
        <LinearGradient
          colors={[categoryColor, categoryColor]} // El botón hereda el color elegido
          style={styles.saveBtn}
        >
          <Text style={styles.saveText}>
            {habitToEdit ? 'Guardar Cambios' : 'Crear Hábito'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 20 },
  backButton: { marginRight: 15 },
  title: { fontSize: 28, fontWeight: '800' },

  card: { borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 15, letterSpacing: 1 },

  row: { flexDirection: 'row', alignItems: 'center' },

  iconInputContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  iconInput: { fontSize: 30 },

  nameInput: { flex: 1, fontSize: 18, fontWeight: '600', paddingVertical: 10 },

  catNameInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 15 },

  colorsRow: { flexDirection: 'row' },
  colorCircle: { width: 40, height: 40, borderRadius: 20, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  colorSelected: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.8)' },

  saveBtn: { padding: 18, borderRadius: 16, alignItems: 'center', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 5 },
  saveText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});