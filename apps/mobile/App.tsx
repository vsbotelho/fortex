import { StatusBar } from 'expo-status-bar';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

interface Oferta {
  id: string;
  rota: string;
  detalhe: string;
  retorno: boolean;
}

// Dados de exemplo até a API de ofertas existir.
const OFERTAS: Oferta[] = [
  { id: '1', rota: 'Rio Verde, GO → Uberlândia, MG', detalhe: 'Soja a granel · 37 t · 430 km', retorno: true },
  { id: '2', rota: 'Jataí, GO → Araguari, MG', detalhe: 'Milho a granel · 35 t · 520 km', retorno: false },
];

export default function App() {
  return (
    <SafeAreaView style={s.tela}>
      <StatusBar style="light" />
      <View style={s.topo}>
        <Text style={s.marca}>FORTEX</Text>
        <Text style={s.topoSub}>Fretes no piso ANTT ou acima. Você recebe 100%.</Text>
      </View>
      <FlatList
        contentContainerStyle={s.lista}
        data={OFERTAS}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={<Text style={s.titulo}>Fretes para você</Text>}
        renderItem={({ item }) => (
          <View style={[s.cartao, item.retorno && s.cartaoDestaque]}>
            {item.retorno && <Text style={s.selo}>Retorno para o seu destino</Text>}
            <Text style={s.rota}>{item.rota}</Text>
            <Text style={s.detalhe}>{item.detalhe}</Text>
            <Pressable accessibilityRole="button" style={s.botao}>
              <Text style={s.botaoTexto}>Ver frete</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#F4F6F3' },
  topo: { backgroundColor: '#15201A', padding: 20, gap: 6 },
  marca: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', letterSpacing: 0.5 },
  topoSub: { color: '#B8C6BD', fontSize: 14 },
  lista: { padding: 16, gap: 12 },
  titulo: { fontSize: 22, fontWeight: '700', color: '#15201A', marginBottom: 4 },
  cartao: { backgroundColor: '#FFFFFF', borderColor: '#DDE3DE', borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  cartaoDestaque: { borderColor: '#1E6B43', borderWidth: 2 },
  selo: { alignSelf: 'flex-start', backgroundColor: '#E3F0E8', color: '#14502F', fontSize: 13, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  rota: { fontSize: 18, fontWeight: '600', color: '#15201A' },
  detalhe: { fontSize: 14, color: '#55625A' },
  botao: { minHeight: 44, borderRadius: 8, backgroundColor: '#1E6B43', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
