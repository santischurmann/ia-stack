// Lector comun del protocolo partido: SKILL.md (nucleo) + phases/*.md, en ese orden.
//
// POR QUE EXISTE. Desde la 3.4.1 SKILL.md es un nucleo de 20 KB y cada fase vive en su archivo.
// Los gates, el instalador y las pruebas que antes leian SKILL.md entero tienen que leer lo mismo
// que antes, sin que cada uno arme su propia lista de archivos y se le escape una fase.
//
// LIMITE HONESTO. Concatena; no sabe que fase esta en curso ni valida el contenido.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function archivosProtocolo(raiz) {
  const dir = join(raiz, 'phases');
  const fases = existsSync(dir)
    ? readdirSync(dir).filter((f) => /^\d{2}-[\w-]+\.md$/.test(f)).sort()
    : [];
  return [join(raiz, 'SKILL.md'), ...fases.map((f) => join(dir, f))];
}

export function leerProtocolo(raiz) {
  return archivosProtocolo(raiz).map((r) => readFileSync(r, 'utf8')).join('\n');
}
