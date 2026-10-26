import { Inject, Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import {
  calcularPiso,
  calcularPrecoSugerido,
  CoeficienteNaoEncontradoError,
  Cotacao,
  FreteAbaixoDoPisoError,
  montarCotacao,
  ResultadoPiso,
  TabelaPiso,
  TaxaFortex,
  TipoCarga,
} from '@fortex/pricing';
import { TABELA_PISO } from './tokens';

export interface PedidoCotacao {
  tipoCarga: TipoCarga;
  eixos: number;
  distanciaKm: number;
  /** Frete proposto pelo embarcador, em centavos. Ausente: usa o sugerido. */
  frete?: number;
  referenciaCorredor?: number;
  valePedagio: number;
  adiantamentoPercentual: number;
}

export interface RespostaCotacao {
  piso: ResultadoPiso;
  precoSugerido: number;
  cotacao: Cotacao;
}

// PENDENTE: definir com o cliente. Valor do exemplo do estudo v0.3.
const TAXA_PADRAO: TaxaFortex = { tipo: 'percentual', percentual: 8 };

@Injectable()
export class CotacaoService {
  constructor(@Inject(TABELA_PISO) private readonly tabela: TabelaPiso) {}

  cotar(p: PedidoCotacao): RespostaCotacao {
    let piso: ResultadoPiso;
    try {
      piso = calcularPiso({ tipoCarga: p.tipoCarga, eixos: p.eixos, distanciaKm: p.distanciaKm }, this.tabela);
    } catch (e) {
      if (e instanceof CoeficienteNaoEncontradoError) {
        throw new ServiceUnavailableException({ codigo: 'TABELA_PISO_INDISPONIVEL', mensagem: e.message });
      }
      throw new UnprocessableEntityException({ codigo: 'ENTRADA_INVALIDA', mensagem: (e as Error).message });
    }

    const { sugerido } = calcularPrecoSugerido({ piso: piso.valor, referenciaCorredor: p.referenciaCorredor });
    const frete = p.frete ?? sugerido;

    try {
      const cotacao = montarCotacao({
        frete,
        piso: piso.valor,
        valePedagio: p.valePedagio,
        taxa: TAXA_PADRAO,
        adiantamentoPercentual: p.adiantamentoPercentual,
      });
      return { piso, precoSugerido: sugerido, cotacao };
    } catch (e) {
      if (e instanceof FreteAbaixoDoPisoError) {
        throw new UnprocessableEntityException({
          codigo: 'ABAIXO_DO_PISO',
          mensagem: 'Valor abaixo do piso ANTT para esta rota. Use o preço sugerido ou um valor maior.',
          piso: piso.valor,
          precoSugerido: sugerido,
        });
      }
      throw new UnprocessableEntityException({ codigo: 'ENTRADA_INVALIDA', mensagem: (e as Error).message });
    }
  }
}
