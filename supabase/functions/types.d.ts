declare module 'jsr:*'
declare module 'npm:*'

declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}
