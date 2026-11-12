// Importado antes de tudo no main.tsx: /demo ou ?demo precisam virar modo demonstração antes de o
// app ler o modo (estado salvo, cliente do banco e login dependem dele).
import { entrarNaDemoPeloLink } from './lib/modo'

entrarNaDemoPeloLink()
