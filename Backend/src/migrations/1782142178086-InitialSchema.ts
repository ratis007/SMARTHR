import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1782142178086 implements MigrationInterface {
    name = 'InitialSchema1782142178086'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "permissions" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "module" character varying, CONSTRAINT "UQ_48ce552495d14eae9b187bb6716" UNIQUE ("name"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "roles" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "status" character varying NOT NULL DEFAULT 'active', "last_login" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "exchange_rate_history" ("id" SERIAL NOT NULL, "company_id" integer NOT NULL, "from_currency" character varying NOT NULL, "to_currency" character varying NOT NULL, "rate" numeric(15,4) NOT NULL, "source" character varying NOT NULL DEFAULT 'manual', "effective_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_34dcdb7ed2b43bc8a4e1023201d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "currency_settings" ("id" SERIAL NOT NULL, "company_id" integer NOT NULL, "primary_currency" character varying NOT NULL DEFAULT 'CDF', "secondary_currency" character varying NOT NULL DEFAULT 'USD', "usd_to_cdf_rate" numeric(15,4) NOT NULL DEFAULT '2850', "rate_source" character varying NOT NULL DEFAULT 'manual', "rounding_mode" character varying NOT NULL DEFAULT 'nearest', "rounding_precision" integer NOT NULL DEFAULT '2', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ed2e6beed351e8af62c6e57a1cd" UNIQUE ("company_id"), CONSTRAINT "PK_0f030551e0990c29b4db6f0f62b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "company_settings" ("id" SERIAL NOT NULL, "company_id" integer NOT NULL, "setting_type" character varying NOT NULL, "name" character varying NOT NULL, "code" character varying, "description" character varying, "config" jsonb, "is_required" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_036b4634217db79c17305442dbe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "companies" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "rccm" character varying, "id_nat" character varying, "tax_number" character varying, "address" character varying, "phone" character varying, "email" character varying, "logo" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."contracts_type_enum" AS ENUM('CDI', 'CDD', 'STAGE', 'CONSULTANT')`);
        await queryRunner.query(`CREATE TYPE "public"."contracts_status_enum" AS ENUM('active', 'expired', 'terminated')`);
        await queryRunner.query(`CREATE TABLE "contracts" ("id" SERIAL NOT NULL, "employee_id" integer NOT NULL, "type" "public"."contracts_type_enum" NOT NULL, "start_date" date NOT NULL, "end_date" date, "salary" numeric(15,2) NOT NULL, "status" "public"."contracts_status_enum" NOT NULL DEFAULT 'active', "notes" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2c7b8f3a7b1acdd49497d83d0fb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."employees_gender_enum" AS ENUM('M', 'F')`);
        await queryRunner.query(`CREATE TYPE "public"."employees_status_enum" AS ENUM('active', 'inactive', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "employees" ("id" SERIAL NOT NULL, "matricule" character varying NOT NULL, "last_name" character varying NOT NULL, "middle_name" character varying, "first_name" character varying NOT NULL, "birth_date" date, "nationality" character varying, "gender" "public"."employees_gender_enum", "address" character varying, "phone" character varying, "email" character varying, "department" character varying, "position" character varying, "base_salary" numeric(15,2) NOT NULL DEFAULT '0', "status" "public"."employees_status_enum" NOT NULL DEFAULT 'active', "company_id" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_82bd55d23a727b37889f69dff2e" UNIQUE ("matricule"), CONSTRAINT "PK_b9535a98350d5b26e7eb0c26af4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."payroll_details_type_enum" AS ENUM('allowance', 'deduction')`);
        await queryRunner.query(`CREATE TABLE "payroll_details" ("id" SERIAL NOT NULL, "payroll_id" integer NOT NULL, "label" character varying NOT NULL, "code" character varying, "category" character varying, "type" "public"."payroll_details_type_enum" NOT NULL, "base_amount" numeric(15,2), "amount" numeric(15,2) NOT NULL, "employer_amount" numeric(15,2) NOT NULL DEFAULT '0', "rate" numeric(5,2), "metadata" jsonb, CONSTRAINT "PK_1c3bd68b56448736ba33e0353c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."payrolls_status_enum" AS ENUM('draft', 'preparation', 'review', 'validated', 'closed', 'paid', 'archived')`);
        await queryRunner.query(`CREATE TABLE "payrolls" ("id" SERIAL NOT NULL, "employee_id" integer NOT NULL, "month" integer NOT NULL, "year" integer NOT NULL, "base_salary" numeric(15,2) NOT NULL DEFAULT '0', "total_allowances" numeric(15,2) NOT NULL DEFAULT '0', "total_deductions" numeric(15,2) NOT NULL DEFAULT '0', "gross_salary" numeric(15,2) NOT NULL DEFAULT '0', "taxable_salary" numeric(15,2) NOT NULL DEFAULT '0', "net_fiscal" numeric(15,2) NOT NULL DEFAULT '0', "employer_contributions" numeric(15,2) NOT NULL DEFAULT '0', "net_salary" numeric(15,2) NOT NULL DEFAULT '0', "currency" character varying NOT NULL DEFAULT 'CDF', "exchange_rate" numeric(15,4) NOT NULL DEFAULT '1', "workflow_step" character varying NOT NULL DEFAULT 'draft', "calculation_snapshot" jsonb, "status" "public"."payrolls_status_enum" NOT NULL DEFAULT 'draft', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fec3a6e31e833dfefa4d958b38f" UNIQUE ("employee_id", "month", "year"), CONSTRAINT "PK_4fc19dcf3522661435565b5ecf3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" SERIAL NOT NULL, "user_id" integer, "action" character varying NOT NULL, "entity" character varying, "entity_id" integer, "details" jsonb, "ip_address" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."employee_documents_document_type_enum" AS ENUM('contract', 'diploma', 'id_card', 'cv', 'other')`);
        await queryRunner.query(`CREATE TABLE "employee_documents" ("id" SERIAL NOT NULL, "employee_id" integer NOT NULL, "document_type" "public"."employee_documents_document_type_enum" NOT NULL DEFAULT 'other', "file_name" character varying NOT NULL, "original_name" character varying, "file_path" character varying NOT NULL, "file_size" bigint NOT NULL, "mime_type" character varying NOT NULL, "uploaded_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c19b36f5e604e261fb430293b68" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."leave_requests_type_enum" AS ENUM('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."leave_requests_status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "leave_requests" ("id" SERIAL NOT NULL, "employee_id" integer NOT NULL, "type" "public"."leave_requests_type_enum" NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "reason" character varying, "status" "public"."leave_requests_status_enum" NOT NULL DEFAULT 'pending', "days" integer, "approved_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d3abcf9a16cef1450129e06fa9f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role_permissions" ("role_id" integer NOT NULL, "permission_id" integer NOT NULL, CONSTRAINT "PK_25d24010f53bb80b78e412c9656" PRIMARY KEY ("role_id", "permission_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_178199805b901ccd220ab7740e" ON "role_permissions" ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_17022daf3f885f7d35423e9971" ON "role_permissions" ("permission_id") `);
        await queryRunner.query(`CREATE TABLE "user_roles" ("user_id" integer NOT NULL, "role_id" integer NOT NULL, CONSTRAINT "PK_23ed6f04fe43066df08379fd034" PRIMARY KEY ("user_id", "role_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_87b8888186ca9769c960e92687" ON "user_roles" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b23c65e50a758245a33ee35fda" ON "user_roles" ("role_id") `);
        await queryRunner.query(`ALTER TABLE "contracts" ADD CONSTRAINT "FK_c8e795ea857e404f9a2b6133208" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_7f3eeef59eece4147effe7bfa6a" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_details" ADD CONSTRAINT "FK_d327f06346336d05e57883d7231" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payrolls" ADD CONSTRAINT "FK_5145d894f823722a43ec3e1955e" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_documents" ADD CONSTRAINT "FK_7fce49bcbfe15a73953b2809944" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_documents" ADD CONSTRAINT "FK_a921cb34121aea4392f6a0f6ff3" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leave_requests" ADD CONSTRAINT "FK_52b4b7c7d295e204add6dbe0a09" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`);
        await queryRunner.query(`ALTER TABLE "leave_requests" DROP CONSTRAINT "FK_52b4b7c7d295e204add6dbe0a09"`);
        await queryRunner.query(`ALTER TABLE "employee_documents" DROP CONSTRAINT "FK_a921cb34121aea4392f6a0f6ff3"`);
        await queryRunner.query(`ALTER TABLE "employee_documents" DROP CONSTRAINT "FK_7fce49bcbfe15a73953b2809944"`);
        await queryRunner.query(`ALTER TABLE "payrolls" DROP CONSTRAINT "FK_5145d894f823722a43ec3e1955e"`);
        await queryRunner.query(`ALTER TABLE "payroll_details" DROP CONSTRAINT "FK_d327f06346336d05e57883d7231"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_7f3eeef59eece4147effe7bfa6a"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "FK_c8e795ea857e404f9a2b6133208"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b23c65e50a758245a33ee35fda"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87b8888186ca9769c960e92687"`);
        await queryRunner.query(`DROP TABLE "user_roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_17022daf3f885f7d35423e9971"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_178199805b901ccd220ab7740e"`);
        await queryRunner.query(`DROP TABLE "role_permissions"`);
        await queryRunner.query(`DROP TABLE "leave_requests"`);
        await queryRunner.query(`DROP TYPE "public"."leave_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."leave_requests_type_enum"`);
        await queryRunner.query(`DROP TABLE "employee_documents"`);
        await queryRunner.query(`DROP TYPE "public"."employee_documents_document_type_enum"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TABLE "payrolls"`);
        await queryRunner.query(`DROP TYPE "public"."payrolls_status_enum"`);
        await queryRunner.query(`DROP TABLE "payroll_details"`);
        await queryRunner.query(`DROP TYPE "public"."payroll_details_type_enum"`);
        await queryRunner.query(`DROP TABLE "employees"`);
        await queryRunner.query(`DROP TYPE "public"."employees_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."employees_gender_enum"`);
        await queryRunner.query(`DROP TABLE "contracts"`);
        await queryRunner.query(`DROP TYPE "public"."contracts_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."contracts_type_enum"`);
        await queryRunner.query(`DROP TABLE "companies"`);
        await queryRunner.query(`DROP TABLE "company_settings"`);
        await queryRunner.query(`DROP TABLE "currency_settings"`);
        await queryRunner.query(`DROP TABLE "exchange_rate_history"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP TABLE "permissions"`);
    }

}
