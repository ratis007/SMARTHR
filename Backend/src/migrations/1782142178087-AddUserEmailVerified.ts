import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserEmailVerified1782142178087 implements MigrationInterface {
  name = 'AddUserEmailVerified1782142178087';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "email_verified" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified"`);
  }
}
