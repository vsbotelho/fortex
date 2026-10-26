CREATE TYPE "public"."carroceria" AS ENUM('GRANELEIRO', 'BASCULANTE');--> statement-breakpoint
CREATE TYPE "public"."status_verificacao" AS ENUM('PENDENTE', 'EM_ANALISE', 'APROVADO', 'REPROVADO');--> statement-breakpoint
CREATE TYPE "public"."tipo_transportador" AS ENUM('TAC', 'ETC');--> statement-breakpoint
CREATE TABLE "embarcadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento" text NOT NULL,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"email" text NOT NULL,
	"status_verificacao" "status_verificacao" DEFAULT 'PENDENTE' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "embarcadores_documento_unique" UNIQUE("documento")
);
--> statement-breakpoint
CREATE TABLE "transportadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_transportador" NOT NULL,
	"documento" text NOT NULL,
	"nome" text NOT NULL,
	"rntrc" text NOT NULL,
	"cnh" text,
	"telefone" text NOT NULL,
	"email" text,
	"status_verificacao" "status_verificacao" DEFAULT 'PENDENTE' NOT NULL,
	"motivo_reprovacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transportadores_documento_unique" UNIQUE("documento"),
	CONSTRAINT "transportadores_rntrc_unique" UNIQUE("rntrc"),
	CONSTRAINT "tac_exige_cnh" CHECK ("transportadores"."tipo" <> 'TAC' OR "transportadores"."cnh" IS NOT NULL),
	CONSTRAINT "reprovado_exige_motivo" CHECK ("transportadores"."status_verificacao" <> 'REPROVADO' OR "transportadores"."motivo_reprovacao" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "veiculos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transportador_id" uuid NOT NULL,
	"placa" text NOT NULL,
	"renavam" text NOT NULL,
	"eixos" integer NOT NULL,
	"carroceria" "carroceria" NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "veiculos_placa_unique" UNIQUE("placa"),
	CONSTRAINT "veiculos_renavam_unique" UNIQUE("renavam"),
	CONSTRAINT "eixos_validos" CHECK ("veiculos"."eixos" IN (2, 3, 4, 5, 6, 7, 9))
);
--> statement-breakpoint
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_transportador_id_transportadores_id_fk" FOREIGN KEY ("transportador_id") REFERENCES "public"."transportadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "veiculos_transportador_idx" ON "veiculos" USING btree ("transportador_id");