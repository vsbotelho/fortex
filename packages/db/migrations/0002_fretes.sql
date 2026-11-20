CREATE TYPE "public"."status_frete" AS ENUM('PUBLICADO', 'ACEITO', 'EM_COLETA', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."tipo_carga" AS ENUM('GRANEL_SOLIDO', 'GRANEL_LIQUIDO', 'FRIGORIFICADA', 'CONTEINERIZADA', 'CARGA_GERAL', 'NEOGRANEL', 'GRANEL_PRESSURIZADA');--> statement-breakpoint
CREATE TABLE "disponibilidades" (
	"transportador_id" uuid PRIMARY KEY NOT NULL,
	"disponivel" boolean NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"destino_nome" text,
	"destino_lat" double precision,
	"destino_lng" double precision,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frete_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"frete_id" uuid NOT NULL,
	"de" "status_frete",
	"para" "status_frete" NOT NULL,
	"usuario_id" uuid,
	"dados" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fretes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"embarcador_id" uuid NOT NULL,
	"origem_nome" text NOT NULL,
	"origem_lat" double precision NOT NULL,
	"origem_lng" double precision NOT NULL,
	"destino_nome" text NOT NULL,
	"destino_lat" double precision NOT NULL,
	"destino_lng" double precision NOT NULL,
	"distancia_km" numeric(8, 1) NOT NULL,
	"tipo_carga" "tipo_carga" NOT NULL,
	"produto" text NOT NULL,
	"peso_kg" integer NOT NULL,
	"eixos" integer NOT NULL,
	"carroceria" "carroceria" NOT NULL,
	"coleta_inicio" timestamp with time zone NOT NULL,
	"coleta_fim" timestamp with time zone NOT NULL,
	"observacoes" text,
	"piso_centavos" integer NOT NULL,
	"norma_piso" text NOT NULL,
	"frete_centavos" integer NOT NULL,
	"adiantamento_percentual" integer NOT NULL,
	"adiantamento_centavos" integer NOT NULL,
	"saldo_centavos" integer NOT NULL,
	"vale_pedagio_centavos" integer NOT NULL,
	"taxa_fortex_centavos" integer NOT NULL,
	"status" "status_frete" DEFAULT 'PUBLICADO' NOT NULL,
	"transportador_id" uuid,
	"veiculo_id" uuid,
	"aceito_em" timestamp with time zone,
	"motivo_cancelamento" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "frete_no_piso" CHECK ("fretes"."frete_centavos" >= "fretes"."piso_centavos" AND "fretes"."piso_centavos" > 0),
	CONSTRAINT "frete_integral" CHECK ("fretes"."adiantamento_centavos" + "fretes"."saldo_centavos" = "fretes"."frete_centavos"),
	CONSTRAINT "adiantamento_valido" CHECK ("fretes"."adiantamento_percentual" BETWEEN 0 AND 100),
	CONSTRAINT "frete_eixos_validos" CHECK ("fretes"."eixos" IN (2, 3, 4, 5, 6, 7, 9)),
	CONSTRAINT "peso_positivo" CHECK ("fretes"."peso_kg" > 0),
	CONSTRAINT "distancia_positiva" CHECK ("fretes"."distancia_km" > 0),
	CONSTRAINT "janela_coleta" CHECK ("fretes"."coleta_fim" > "fretes"."coleta_inicio"),
	CONSTRAINT "aceite_tem_motorista" CHECK ("fretes"."status" IN ('PUBLICADO', 'CANCELADO') OR ("fretes"."transportador_id" IS NOT NULL AND "fretes"."veiculo_id" IS NOT NULL AND "fretes"."aceito_em" IS NOT NULL)),
	CONSTRAINT "cancelado_exige_motivo" CHECK ("fretes"."status" <> 'CANCELADO' OR "fretes"."motivo_cancelamento" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_transportador_id_transportadores_id_fk" FOREIGN KEY ("transportador_id") REFERENCES "public"."transportadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frete_eventos" ADD CONSTRAINT "frete_eventos_frete_id_fretes_id_fk" FOREIGN KEY ("frete_id") REFERENCES "public"."fretes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frete_eventos" ADD CONSTRAINT "frete_eventos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fretes" ADD CONSTRAINT "fretes_embarcador_id_embarcadores_id_fk" FOREIGN KEY ("embarcador_id") REFERENCES "public"."embarcadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fretes" ADD CONSTRAINT "fretes_transportador_id_transportadores_id_fk" FOREIGN KEY ("transportador_id") REFERENCES "public"."transportadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fretes" ADD CONSTRAINT "fretes_veiculo_id_veiculos_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "frete_eventos_frete_idx" ON "frete_eventos" USING btree ("frete_id","criado_em");--> statement-breakpoint
CREATE INDEX "fretes_status_idx" ON "fretes" USING btree ("status","coleta_inicio");--> statement-breakpoint
CREATE INDEX "fretes_embarcador_idx" ON "fretes" USING btree ("embarcador_id");--> statement-breakpoint
CREATE UNIQUE INDEX "um_frete_ativo_por_transportador" ON "fretes" USING btree ("transportador_id") WHERE "fretes"."status" IN ('ACEITO', 'EM_COLETA', 'EM_TRANSITO');