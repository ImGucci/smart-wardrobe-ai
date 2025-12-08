export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY?: string;
      ZENMUX_API_KEY?: string;
      API_PROVIDER?: string;
      [key: string]: string | undefined;
    }
  }
}
