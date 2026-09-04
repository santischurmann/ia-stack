// Donde estoy corriendo, y por que importa.
//
// El instalador copia tests/ ENTERO al proyecto de otra persona, en
// `<proyecto>/.vibe/vcp-runtime/tests/`. Ahi adentro conviven dos cosas que no son lo mismo:
//
//   - pruebas OPERATIVAS, que ejercitan los gates y tienen sentido en cualquier proyecto;
//   - SELF-CHECKS del repositorio de VCP, que leen el README, el CHANGELOG, docs/ o examples/
//     para comprobar que ESTE repositorio es consistente consigo mismo.
//
// Los segundos no tienen nada que preguntarle al proyecto de quien instala, y ademas fallan: el
// instalador no copia esos archivos. Medido contra un proyecto ficticio de un tercero: 41 fallos
// sobre 1090, casi todos por leer un README que ahi no existe. El repositorio verde y todas las
// instalaciones en rojo.
//
// Un self-check llego a hacer algo peor que fallar: corria `git remote get-url origin` DENTRO del
// repositorio ajeno para despues exigir que el README de VCP lo nombrara.
//
// La deteccion es por FORMA y no por una lista de rutas: un runtime instalado siempre vive en
// `<algo>/.vibe/vcp-runtime`. Y nada se saltea en silencio -- se saltea diciendo por que, que es la
// diferencia entre declarar un limite y esconder un hueco.

import { basename, dirname } from 'node:path';

export const RAIZ_RUNTIME = 'vcp-runtime';
export const CARPETA_VCP = '.vibe';

export function esRuntimeInstalado(root) {
  return basename(root) === RAIZ_RUNTIME && basename(dirname(root)) === CARPETA_VCP;
}

// Lo que el instalador SI deja en la raiz del runtime. Cualquier otra cosa que una prueba lea desde
// la raiz solo existe en el checkout fuente. La lista vive aca y en `COPIED_DIRECTORIES` de
// scripts/verify-runtime-sync.mjs; tests/self-checks.test.mjs falla si se separan.
export const COPIADO_A_LA_RAIZ = Object.freeze(['scripts', 'contracts', 'tests', 'templates', 'skills', '.agents', 'SKILL.md', 'SECURITY.md', 'AGENTS.md']);

export function existeEnRuntimeInstalado(rutaRelativa) {
  const primero = rutaRelativa.replaceAll('\\', '/').split('/')[0];
  return COPIADO_A_LA_RAIZ.includes(primero);
}

// Marca una prueba como self-check del repositorio. Devuelve true si hay que cortar.
export function saltarSiEsRuntimeInstalado(t, root, que) {
  if (!esRuntimeInstalado(root)) return false;
  t.skip(`runtime instalado: «${que}» es un self-check del repositorio de VCP, no del proyecto de quien instala`);
  return true;
}
