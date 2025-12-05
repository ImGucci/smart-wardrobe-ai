/*
  The @imgly/background-removal package v1.7.0 includes its own type definitions.
  We are keeping this file as a placeholder but commenting out the contents 
  to avoid "Duplicate identifier" errors during the TypeScript build step.
*/

/*
declare module '@imgly/background-removal' {
  export interface Config {
    publicPath?: string;
    debug?: boolean;
    device?: 'cpu' | 'gpu';
    proxy?: string;
    model?: 'small' | 'medium';
    output?: {
      format?: 'image/png' | 'image/jpeg' | 'image/webp';
      quality?: number;
      type?: 'foreground' | 'background' | 'mask';
    };
    progress?: (key: string, current: number, total: number) => void;
  }

  export function removeBackground(
    image: Blob | File | string | HTMLImageElement,
    config?: Config
  ): Promise<Blob>;

  const content: {
    removeBackground: typeof removeBackground;
  };
  export default content;
}
*/