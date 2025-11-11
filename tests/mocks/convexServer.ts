type Builder<T = unknown> = (definition: T) => T;

const passthrough: Builder = (definition) => definition;

export const query: Builder = passthrough;
export const mutation: Builder = passthrough;
export const internalQuery: Builder = passthrough;
export const internalMutation: Builder = passthrough;
export const action: Builder = passthrough;
export const internalAction: Builder = passthrough;
export const httpAction: Builder = passthrough;

export type QueryCtx = {
  db: {
    query: (...args: any[]) => any;
  };
};

export type MutationCtx = QueryCtx;
export type ActionCtx = QueryCtx;

export type GenericQueryCtx<T = unknown> = QueryCtx;
export type GenericMutationCtx<T = unknown> = MutationCtx;
export type GenericActionCtx<T = unknown> = ActionCtx;
export type GenericDatabaseReader<T = unknown> = unknown;
export type GenericDatabaseWriter<T = unknown> = unknown;
export type FunctionReference = unknown;
export type AnyComponents = unknown;
export type ActionBuilder = Builder;
export type HttpActionBuilder = Builder;
export type QueryBuilder = Builder;
export type MutationBuilder = Builder;
export type DatabaseReader = GenericDatabaseReader;
export type DatabaseWriter = GenericDatabaseWriter;
