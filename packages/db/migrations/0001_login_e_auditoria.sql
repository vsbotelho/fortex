CREATE TYPE "public"."papel_usuario" AS ENUM('NOVO', 'MOTORISTA', 'EMBARCADOR', 'ADMIN');--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid,
	"dados" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codigos_acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telefone" text NOT NULL,
	"hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"usado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"hash_token" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"revogada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessoes_hash_token_unique" UNIQUE("hash_token")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telefone" text NOT NULL,
	"papel" "papel_usuario" DEFAULT 'NOVO' NOT NULL,
	"transportador_id" uuid,
	"embarcador_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_acesso_em" timestamp with time zone,
	CONSTRAINT "usuarios_telefone_unique" UNIQUE("telefone"),
	CONSTRAINT "usuarios_transportador_id_unique" UNIQUE("transportador_id"),
	CONSTRAINT "usuarios_embarcador_id_unique" UNIQUE("embarcador_id"),
	CONSTRAINT "um_vinculo_so" CHECK ("usuarios"."transportador_id" IS NULL OR "usuarios"."embarcador_id" IS NULL),
	CONSTRAINT "papel_coerente" CHECK (("usuarios"."papel" <> 'MOTORISTA' OR "usuarios"."transportador_id" IS NOT NULL) AND ("usuarios"."papel" <> 'EMBARCADOR' OR "usuarios"."embarcador_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "embarcadores" ADD COLUMN "motivo_reprovacao" text;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_transportador_id_transportadores_id_fk" FOREIGN KEY ("transportador_id") REFERENCES "public"."transportadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_embarcador_id_embarcadores_id_fk" FOREIGN KEY ("embarcador_id") REFERENCES "public"."embarcadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_entidade_idx" ON "auditoria" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "codigos_telefone_idx" ON "codigos_acesso" USING btree ("telefone","criado_em");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id");--> statement-breakpoint
ALTER TABLE "embarcadores" ADD CONSTRAINT "embarcador_reprovado_exige_motivo" CHECK ("embarcadores"."status_verificacao" <> 'REPROVADO' OR "embarcadores"."motivo_reprovacao" IS NOT NULL);