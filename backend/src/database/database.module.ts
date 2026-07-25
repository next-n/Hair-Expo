import { DynamicModule, Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

export const DATABASE_PATH = Symbol('DATABASE_PATH');

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(databasePath: string): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: DATABASE_PATH, useValue: databasePath },
        DatabaseService,
      ],
      exports: [DatabaseService],
    };
  }
}
