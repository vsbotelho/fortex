'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Cotacao {
  freteTransportador: number;
  adiantamentoColeta: number;
  saldoEntrega: number;
  valePedagio: number;
  aporteIpef: number;
  taxaFortex: number;
}

interface Resposta {
  piso: { valor: number; norma: string };
  precoSugerido: number;
  cotacao: Cotacao;
}

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Converte "1.234,56" em centavos. */
const paraCentavos = (texto: string) => {
  const limpo = texto.replace(/[^\d,]/g, '').replace(',', '.');
  return limpo ? Math.round(Number(limpo) * 100) : undefined;
};

export function PublicarCarga() {
  const [distanciaKm, setDistanciaKm] = useState('430');
  const [eixos, setEixos] = useState('5');
  const [adiantamento, setAdiantamento] = useState('40');
  const [frete, setFrete] = useState('');
  const [valePedagio, setValePedagio] = useState('');
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function cotar(freteCentavos?: number) {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`${API}/cotacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoCarga: 'GRANEL_SOLIDO',
          eixos: Number(eixos),
          distanciaKm: Number(distanciaKm),
          frete: freteCentavos,
          valePedagio: paraCentavos(valePedagio) ?? 0,
          adiantamentoPercentual: Number(adiantamento),
        }),
      });
      const dados = await r.json();
      if (!r.ok) {
        setResposta(null);
        setErro(dados?.message?.mensagem ?? dados?.mensagem ?? 'Não foi possível cotar.');
        return;
      }
      setResposta(dados);
    } catch {
      setErro('API indisponível. Verifique se ela está rodando.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="grade">
      <form
        className="cartao formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void cotar(paraCentavos(frete));
        }}
      >
        <div className="campo">
          <label htmlFor="tipo">Tipo de carga</label>
          <select id="tipo" disabled>
            <option>Granel sólido (grãos)</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="distancia">Distância (km)</label>
          <input id="distancia" inputMode="numeric" value={distanciaKm} onChange={(e) => setDistanciaKm(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="eixos">Eixos</label>
          <select id="eixos" value={eixos} onChange={(e) => setEixos(e.target.value)}>
            {[5, 6, 7, 9].map((n) => (
              <option key={n} value={n}>{n} eixos</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="adiantamento">Adiantamento na coleta (%)</label>
          <input id="adiantamento" inputMode="numeric" value={adiantamento} onChange={(e) => setAdiantamento(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="pedagio">Vale-Pedágio (R$)</label>
          <input id="pedagio" inputMode="decimal" value={valePedagio} onChange={(e) => setValePedagio(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="frete">Frete oferecido (R$) — vazio usa o sugerido</label>
          <input id="frete" inputMode="decimal" value={frete} onChange={(e) => setFrete(e.target.value)} aria-describedby={erro ? 'erro' : undefined} />
        </div>
        <button type="submit" disabled={carregando}>{carregando ? 'Calculando…' : 'Calcular cotação'}</button>
      </form>

      <aside className="cartao resumo" aria-label="Resumo da cotação" aria-live="polite">
        <h2 style={{ margin: 0 }}>Cotação</h2>
        {erro && <div id="erro" className="erro">{erro}</div>}
        {erro && resposta === null && (
          <button type="button" className="secundario" onClick={() => { setFrete(''); void cotar(undefined); }}>
            Usar preço sugerido
          </button>
        )}
        {resposta && (
          <>
            <div className="linha"><span className="rotulo">Piso ANTT</span><strong>{brl(resposta.piso.valor)}</strong></div>
            <div className="linha"><span className="rotulo">Preço sugerido</span><strong>{brl(resposta.precoSugerido)}</strong></div>
            <hr />
            <div className="linha"><span>Frete (100% ao transportador)</span><strong>{brl(resposta.cotacao.freteTransportador)}</strong></div>
            <div className="linha"><span className="rotulo">Na coleta</span><span>{brl(resposta.cotacao.adiantamentoColeta)}</span></div>
            <div className="linha"><span className="rotulo">Na entrega</span><span>{brl(resposta.cotacao.saldoEntrega)}</span></div>
            <div className="linha"><span>Vale-Pedágio</span><strong>{brl(resposta.cotacao.valePedagio)}</strong></div>
            <div className="linha"><span>Aporte na IPEF</span><span className="total">{brl(resposta.cotacao.aporteIpef)}</span></div>
            <div className="linha taxa"><span>Taxa Fortex · nota fiscal própria</span><strong>{brl(resposta.cotacao.taxaFortex)}</strong></div>
            <p className="nota">Base: {resposta.piso.norma}. Estadia após 5 horas de espera é cobrada à parte.</p>
          </>
        )}
        {!resposta && !erro && <p className="nota">Preencha os dados e calcule para ver o piso e a cotação.</p>}
      </aside>
    </div>
  );
}
