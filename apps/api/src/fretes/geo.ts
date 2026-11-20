export interface Ponto {
  lat: number;
  lng: number;
}

const RAIO_TERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distância em linha reta (haversine), em km. */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

/** Caixa aproximada do território brasileiro, para pegar coordenada trocada ou vazia. */
export function noBrasil(p: Ponto): boolean {
  return p.lat >= -34 && p.lat <= 5.5 && p.lng >= -74 && p.lng <= -34;
}

/**
 * A distância rodoviária informada é a base do piso, então não pode ser menor
 * que a linha reta (piso artificialmente baixo) nem absurdamente maior.
 * PENDENTE: calcular a rota por um serviço de roteirização em vez de receber.
 */
export function validarDistanciaRodoviaria(informadaKm: number, origem: Ponto, destino: Ponto): string | null {
  const reta = distanciaKm(origem, destino);
  if (informadaKm < reta) {
    return `Distância menor que a linha reta entre origem e destino (${Math.ceil(reta)} km).`;
  }
  if (reta >= 20 && informadaKm > reta * 3) {
    return `Distância mais de 3 vezes maior que a linha reta (${Math.ceil(reta)} km). Confira origem, destino e quilometragem.`;
  }
  return null;
}
