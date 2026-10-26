import { PublicarCarga } from './publicar-carga';

export default function Pagina() {
  return (
    <main>
      <h1>Publicar carga</h1>
      <p className="sub">O preço é calculado a partir do piso mínimo da ANTT. Nenhum frete é publicado abaixo dele.</p>
      <PublicarCarga />
    </main>
  );
}
