import LottieView from 'lottie-react-native';
import { Modal, StyleSheet, View } from 'react-native';

// Importamos el archivo JSON que descargaste
import confettiAnimation from '../../assets/animations/confetti.lottie';

export default function ConfettiOverlay({ isVisible, onAnimationFinish }) {
    if (!isVisible) return null;

    return (
        // Usamos un Modal transparente para asegurarnos de que cubra TODO,
        // incluso la barra de navegación y pestañas.
        <Modal transparent visible={isVisible} animationType="fade">
            <View style={styles.overlay}>
                <LottieView
                    source={confettiAnimation}
                    autoPlay
                    loop={false} // Solo queremos que se reproduzca una vez
                    resizeMode="cover"
                    style={styles.animation}
                    onAnimationFinish={onAnimationFinish} // Avisa cuando termina
                    speed={1} // Puedes aumentar la velocidad (ej: 1.5) si la notas lenta
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'transparent', // No tapamos el fondo
        justifyContent: 'center',
        alignItems: 'center',
        // Un zIndex alto por seguridad, aunque el Modal ya lo maneja
        zIndex: 9999,
    },
    animation: {
        // Hacemos que la animación ocupe toda la pantalla
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
});