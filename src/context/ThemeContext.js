import { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native'; // Para detectar preferencia del sistema
import { darkTheme, lightTheme } from '../constants/theme';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Detectamos si el móvil ya está en modo oscuro por defecto
  const systemScheme = useColorScheme(); 
  
  // Estado local: por defecto usa lo que diga el sistema ('dark' o 'light')
  const [isDark, setIsDark] = useState(systemScheme === 'dark');

  // Elegimos el objeto de colores correcto según el estado
  const theme = isDark ? darkTheme : lightTheme;

  // Función para cambiar manualmente (Toggle)
  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook personalizado para usar el tema fácil en cualquier pantalla
export const useTheme = () => useContext(ThemeContext);