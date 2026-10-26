import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { TipoCarga } from '@fortex/pricing';
import { CotacaoService, PedidoCotacao } from './cotacao.service';

function exigirNumero(v: unknown, campo: string, opcional = false): number | undefined {
  if (v === undefined && opcional) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new BadRequestException(`Campo "${campo}" deve ser numérico.`);
  }
  return v;
}

function exigirCentavos(v: unknown, campo: string, opcional = false): number | undefined {
  const n = exigirNumero(v, campo, opcional);
  if (n !== undefined && !Number.isInteger(n)) {
    throw new BadRequestException(`Campo "${campo}" deve estar em centavos (inteiro).`);
  }
  return n;
}

@Controller('cotacoes')
export class CotacaoController {
  constructor(private readonly service: CotacaoService) {}

  @Post()
  @HttpCode(200)
  cotar(@Body() body: Record<string, unknown>) {
    if (!Object.values(TipoCarga).includes(body?.tipoCarga as TipoCarga)) {
      throw new BadRequestException('Campo "tipoCarga" inválido.');
    }
    const pedido: PedidoCotacao = {
      tipoCarga: body.tipoCarga as TipoCarga,
      eixos: exigirNumero(body.eixos, 'eixos')!,
      distanciaKm: exigirNumero(body.distanciaKm, 'distanciaKm')!,
      frete: exigirCentavos(body.frete, 'frete', true),
      referenciaCorredor: exigirCentavos(body.referenciaCorredor, 'referenciaCorredor', true),
      valePedagio: exigirCentavos(body.valePedagio ?? 0, 'valePedagio')!,
      adiantamentoPercentual: exigirNumero(body.adiantamentoPercentual, 'adiantamentoPercentual')!,
    };
    return this.service.cotar(pedido);
  }
}
