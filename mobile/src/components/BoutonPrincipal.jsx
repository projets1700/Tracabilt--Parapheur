import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function BoutonPrincipal({ titre, onPress, chargement, variante = 'primaire', desactive }) {
  const estDesactive = chargement || desactive;
  return (
    <TouchableOpacity
      style={[styles.btn, styles[variante], estDesactive && styles.desactive]}
      onPress={onPress}
      disabled={estDesactive}
      activeOpacity={0.8}
    >
      {chargement
        ? <ActivityIndicator color={variante === 'primaire' ? '#fff' : '#185FA5'} />
        : <Text style={[styles.texte, variante === 'secondaire' && styles.texteSecondaire]}>{titre}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaire: { backgroundColor: '#185FA5' },
  secondaire: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E5E0' },
  danger: { backgroundColor: '#E24B4A' },
  desactive: { opacity: 0.5 },
  texte: { color: 'white', fontSize: 16, fontWeight: '600' },
  texteSecondaire: { color: '#185FA5' },
});